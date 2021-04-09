// 支持 replset 副本集群 mongodb 服务
// 暂时只支持 find 功能

const mongodb = require("../../npm.mongodb/node_modules/mongodb/index.js");

const helper = require("../utils/helper");

class mdbmgr {
    constructor() {
        this._name = "mdbmgr";
        this.urls = "";
        this.replasetname = "";
        this.authinfo = null;
        this.client = null;
    }
    // urls: single mongo: 127.0.0.1:10001; replset mongo: 127.0.0.1:10001,127.0.0.1:10002,...
    // replsetname: replset mode needed.
    // callback(error, client)
    // authinfo: {user:'abcd', password:'123456', authMechanism:'DEFAULT', authSource:'admin'}
    // authMechanism: DEFAULT, SCRAM-SHA-1, MONGODB-CR, X509, ...
    init(urls, replsetname, callback, authinfo) {
        helper.log("["+this._name+":init] (",urls+",",replsetname+",","callback,",authinfo,") >>>>>");

        let s = "mongodb://";
        if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.user) && false==helper.isNullOrUndefined(authinfo.password)) {
            s += (encodeURIComponent(authinfo.user) + ":" + encodeURIComponent(authinfo.password) + "@");
        }
        s += (urls+"/?");
        if (false == helper.isNullOrUndefined(replsetname) && replsetname.length > 0) {
            s += ("&replicaSet=" + replsetname);
        }
        if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.authMechanism)) {
            s += ("&authMechanism=" + authinfo.authMechanism);
        }
        if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.authSource)) {
            s += ("&authSource=" + authinfo.authSource);
        }
        s += "&connectTimeoutMS=10000";
        s += "&keepAlive=true"
        s += "&keepAliveInitialDelay=30000"
        s += "&noDelay=true"
        s += "&socketTimeoutMS=30000" // 360 s change to 30 s
        s += "&readPreference=secondaryPreferred";
        //s += "&slaveOk=true";
        helper.log("["+this._name+":init] s:", s);
        let client = new mongodb.MongoClient(s, {
                    autoReconnect: true,
                    //noDelay: true,
                    //keepAlive: true,
                    //keepAliveInitialDelay: 120000,
                    //connectTimeoutMS: 120000,
                    //socketTimeoutMS: 0,
                    reconnectTries: 30,
                    reconnectInterval: 1000,
                    connectWithNoPrimary: false,
                    auto_reconnect: true,
                    //useUnifiedTopology: true,
                    useNewUrlParser: true
        });
        client.connect(s, (e_con)=>{
            if (e_con) {
                helper.logRed("["+this._name+":init] e_con:", e_con.message);
                callback(e_con);
            } else {
                helper.logGreen("["+this._name+":init] client:", client);
                this.urls = urls;
                this.replsetname = replsetname;
                this.authinfo = authinfo;
                this.client = client;

                this.client.db('admin').admin().listDatabases((e_adm,r_adm)=>{
                    if (e_adm) {
                        helper.logRed("["+this._name+":init] e_adm:", e_adm.message);
                    } else {
                        helper.log("["+this._name+":init] r_adm:", r_adm);
                        r_adm.databases.forEach((d)=>{
                            //this.client.db(d.name).collections((e_cols,r_cols)=>{
                            //    if (e_cols) {
                            //        helper.logRed("["+this._name+":init]", d.name, "e_cols:", e_cols.message);
                            //    } else {
                            //        helper.log("["+this._name+":init]", d.name, "r_cols:", r_cols.length);
                            //    }
                            //});
                            this.client.db(d.name).listCollections().toArray((e_lstc,r_lstc)=>{
                                if (e_lstc) {
                                    helper.logRed("["+this._name+":init]", d.name, "e_lstc:", e_lstc.message);
                                } else {
                                    helper.log("["+this._name+":init]", d.name, "r_lstc:", r_lstc.length);
                                }
                            });
                        })
                    }
                });

                callback(null, client);
            }
        });
    }
    // callback(error, collections)
    collections(dbname, callback) {
        helper.log("["+this._name+":collections] (",dbname+",","callback) >>>>>");

        if (helper.isNullOrUndefined(this.client)) {
            helper.logRed("["+this._name+":collections] client(",this.urls,") is null.");
            callback(new Error("client("+this.urls+") is null."));
        } else if (helper.isNullOrUndefined(this.client.db(dbname))) {
            helper.logRed("["+this._name+":collections] db(",this.urls,dbname,") is null.");
            callback(new Error("db("+this.urls+"/"+dbname+") is null."));
        } else {
            this.client.db(dbname).collections((e_cols, r_cols)=>{
                if (e_cols) {
                    helper.logRed("["+this._name+":collections] db(",this.urls,dbname,").collections() e_cols:", e_cols.message);
                    callback(e_cols);
                } else {
                    callback(null, r_cols);
                }
            });
        }
    }
    // callback(error, documents)
    find(dbname, colname, findobj, keyobj, sortobj, skipnum, limitnum, callback) {
        helper.log("["+this._name+":find] (",dbname+",",colname+",",JSON.stringify(findobj)+",",JSON.stringify(keyobj)+",",(helper.isNullOrUndefined(sortobj)?"null":JSON.stringify(sortobj))+",",skipnum+",",limitnum+",","callback) >>>>>");

        if (helper.isNullOrUndefined(this.client)) {
            helper.logRed("["+this._name+":collections] client(",this.urls,") is null.");
            callback(new Error("client("+this.urls+") is null."));
        } else if (helper.isNullOrUndefined(this.client.db(dbname))) {
            helper.logRed("["+this._name+":collections] db(",this.urls,dbname,") is null.");
            callback(new Error("db("+this.urls+"/"+dbname+") is null."));
        } else {
            this.client.db(dbname).collection(colname, {safe:true}, (e_col, r_col)=>{
                if (e_col) {
                    helper.logRed("["+this._name+":find] db(",this.urls,dbname,").collection(",colname,") e_col:", e_col.message);
                    callback(e_col);
                } else {
                    let f = r_col.find(findobj, keyobj);
                    if (false == helper.isNullOrUndefined(sortobj)) {
                        f = f.sort(sortobj);
                    }
                    if (false == helper.isNullOrUndefined(skipnum)) {
                        f = f.skip(skipnum);
                    }
                    if (false == helper.isNullOrUndefined(limitnum)) {
                        f = f.limit(limitnum);
                    }
                    f.maxTimeMs(10000);
                    f.batchSize(1000);
                    f.toArray((e_find,r_find)=>{
                        if (e_find) {
                            helper.logRed("["+this._name+":find] col(",this.urls,dbname,colname,").find(...) e_find:", e_find.message);
                            callback(e_find);
                        } else {
                            helper.logGreen("["+this._name+":find] col(",this.urls,dbname,colname,").find(...) r_find:", r_find.length);
                            callback(null, r_find);
                        }
                    });
                }
            });
        }
    }
    getDb(dbname) {
        helper.log("["+this._name+":getDb] (",this.urls+",",dbname+",",") >>>>>");
        if (helper.isNullOrUndefined(this.client)) {
            return null;
        } else {
            return this.client.db(dbname);
        }
    }
    makeObjectId(string) {
        return mongodb.ObjectID(string);
    }
    close () {
        helper.log("[disdbmgr:close] () >>>>>");
        if (false == helper.isNullOrUndefined(this.client)) {
            this.client.close(true);
            this.client = null;
        }
    }
}

module.exports = mdbmgr;