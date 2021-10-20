// 支持 单个/多个 分布式 mongodb 服务， （非主从模式）
// 多个 mongodb 服务是单独服务
// 例如 把 一批 数据 随即分别 保存在 一组mongodb服务中，可以 查询 这一组 mongodb服务中的数据。
// 暂时 只支持 查询 find 功能

const mongodb = require("../../npm.mongodb/node_modules/mongodb/index.js");

const helper = require("../../common/helper");

class dismdbmgr {
    constructor() {
        this.db_clients = {};
    }
    // urls: [127.0.0.1:10001, 127.0.0.1:10002, ...]
    // callback(error, clients)
    // authinfo: {user:'abcd', password:'123456', authMechanism:'DEFAULT', authSource:'admindb'}
    // authMechanism: DEFAULT, SCRAM-SHA-1, MONGODB-CR, X509, ...
    init(urls, callback, authinfo) {
        helper.log("[dismdbmgr:init] (",urls+",","callback,",authinfo,") >>>>>");

        let pms = [];
        urls.forEach((u)=>{
            pms.push(new Promise((resolve,reject)=>{
                let s = "mongodb://";
                //if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.user) && false==helper.isNullOrUndefined(authinfo.password)) {
                //    s += (encodeURIComponent(authinfo.user) + ":" + encodeURIComponent(authinfo.password) + "@");
                //}
                s += (u+"/?");
                //if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.authMechanism)) {
                //    s += ("&authMechanism=" + authinfo.authMechanism);
                //}
                //if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.authSource)) {
                //    s += ("&authSource=" + authinfo.authSource);
                //}
                //s += "&connectTimeoutMS=10000";
                //s += "&keepAlive=true"
                //s += "&keepAliveInitialDelay=30000"
                //s += "&noDelay=true"
                //s += "&socketTimeoutMS=30000" // 360 s change to 30 s
                s += "&readPreference=secondaryPreferred";
                //s += "&slaveOk=true";
                helper.log("[dismdbmgr:init] s:", s);
                let option = {
                    //autoReconnect: true,
                    noDelay: true,
                    keepAlive: true,
                    keepAliveInitialDelay: 30000,
                    connectTimeoutMS: 30000,
                    socketTimeoutMS: 30000,
                    //readPreference: 'SECONDARY_PREFERRED',
                    //reconnectTries: 30,
                    //reconnectInterval: 1000,
                    connectWithNoPrimary: false,
                    auto_reconnect: true,
                    useUnifiedTopology: true,
                    useNewUrlParser: true
                }
                if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.user) && false==helper.isNullOrUndefined(authinfo.password)) {
                    option.auth = {user:authinfo.user, password:authinfo.password};
                }
                if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.authMechanism)) {
                    option.authMechanism = authinfo.authMechanism;
                }
                if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.authSource)) {
                    option.authSource = authinfo.authSource;
                }
                helper.log("[dismdbmgr:init] option:", option);
                let client = new mongodb.MongoClient(s, option);
                client.connect((e_con)=>{
                    if (e_con) {
                        helper.logRed("[dismdbmgr:init] e_con:", e_con.message);
                        reject(e_con);
                    } else {
                        helper.log("[dismdbmgr:init] client.connect success.");
                        resolve({u, c:client});
                    }
                });
            }));
        });

        Promise.all(pms).then(rs=>{
            rs.forEach((r)=>{
                this.db_clients[r.u] = r.c;

                this.db_clients[r.u].db('admin').admin().listDatabases((e_adm,r_adm)=>{
                    if (e_adm) {
                        helper.logRed("[dismdbmgr:init] e_adm:", e_adm.message);
                    } else {
                        //helper.log("[dismdbmgr:init] r_adm:", r_adm);
                        r_adm.databases.forEach((d)=>{
                            //this.db_clients[r.u].db(d.name).collections((e_cols,r_cols)=>{
                            //    if (e_cols) {
                            //        helper.logRed("[dismdbmgr:init]", d.name, "e_cols:", e_cols.message);
                            //    } else {
                            //        helper.log("[dismdbmgr:init]", d.name, "r_cols:", r_cols.length);
                            //    }
                            //});
                            this.db_clients[r.u].db(d.name).listCollections().toArray((e_lstc,r_lstc)=>{
                                if (e_lstc) {
                                    helper.logRed("[dismdbmgr:init]", d.name, "e_lstc:", e_lstc.message);
                                } else {
                                    helper.log("[dismdbmgr:init]", d.name, "r_lstc:", r_lstc.length);
                                }
                            });
                        })
                    }
                });
            });
            callback(null, rs);
        }).catch(e=>{
            helper.logRed("[dismdbmgr:init] e:", e.message);
            callback(e);
        });
    }
    // callback(error, collections)
    collections(urls, dbname, callback) {
        helper.log("[dismdbmgr:collections] (",urls+",",dbname+",","callback) >>>>>");

        if (helper.isNullOrUndefined(urls)) {
            urls = [];
            for (let c in this.db_clients) { urls.push(c); }
        }

        let pms = [];
        urls.forEach((u)=> {
            pms.push(new Promise((resolve,reject)=>{
                if (helper.isNullOrUndefined(this.db_clients[u])) {
                    helper.logRed("[dismdbmgr:collections] client(",u,") is null.");
                    reject(new Error("client("+u+") is null."));
                } else if (helper.isNullOrUndefined(this.db_clients[u].db(dbname))) {
                    helper.logYellow("[dismdbmgr:collections] db(",u,dbname,") is null.");
                    resolve([]);
                } else {
                    if (false == this.db_clients[u].isConnected()) {
                        //helper.logRed("[dismdbmgr:collections] this.db_clients[",u,"] is connected:", this.db_clients[u].isConnected());
                        reject(new Error("client("+u+") is disconnected."));
                    } else {
                        this.db_clients[u].db(dbname).collections((e_cols, r_cols)=>{
                            if (e_cols) {
                                helper.logRed("[dismdbmgr:collections] db(",u,dbname,").collections() e_cols:", e_cols.message);
                                reject(e_cols);
                            } else {
                                helper.log("[dismdbmgr:collections] get collections done.");
                                resolve(r_cols);
                            }
                        });
                    }
                }
            }));
        });

        Promise.all(pms).then(rs=>{
            let res = [];
            rs.forEach((r)=>{
                res = res.concat(r);
            });
            setTimeout(()=>{ callback(null, res); }, 1);

        }).catch(e=>{
            helper.logRed("[dismdbmgr:collections] e:", e.message);
            callback(e);
        });
    }
    // callback(error, documents)
    find(urls, dbs, colname, findobj, keyobj, sortobj, skipnum, limitnum, callback) {
        helper.log("[dismdbmgr:find] (",urls+",",dbs+",",colname+",",JSON.stringify(findobj)+",",JSON.stringify(keyobj)+",",(helper.isNullOrUndefined(sortobj)?"null":JSON.stringify(sortobj))+",",skipnum+",",limitnum+",","callback) >>>>>");

        if (helper.isNullOrUndefined(urls)) {
            urls = [];
            for (let c in this.db_clients) { urls.push(c); }
        }

        let pms = [];
        urls.forEach((u)=> {
            dbs.split(',').forEach((dbname)=>{
                pms.push(new Promise((resolve,reject)=>{
                    if (helper.isNullOrUndefined(this.db_clients[u])) {
                        helper.logRed("[dismdbmgr:find] client(",u,") is null.");
                        reject(new Error("client("+u+") is null."));
                    } else if (helper.isNullOrUndefined(this.db_clients[u].db(dbname))) {
                        //helper.logGreen(this.db_clients[u]);
                        helper.logYellow("[dismdbmgr:find] db(",u,dbname,") is null.");
                        resolve([]);
                    } else {
                        if (false == this.db_clients[u].isConnected()) {
                            //helper.logRed("[dismdbmgr:find] this.db_clients[",u,"] is connected:", this.db_clients[u].isConnected());
                            reject(new Error("client("+u+") is disconnected."));
                        } else {
                            this.db_clients[u].db(dbname).collection(colname, {safe:true}, async (e_col, r_col)=>{
                                if (e_col) {
                                    helper.logRed("[dismdbmgr:find] db(",u,dbname,").collection(",colname,") e_col:", e_col.message);
                                    reject(e_col);
                                } else {
                                    if (false) {
                                        let opt = {};
                                        for (let k in keyobj) {
                                            opt[k] = keyobj[k];
                                        }
                                        if (false == helper.isNullOrUndefined(sortobj)) {
                                            opt.sort = [];
                                            for (let k in sortobj) {
                                                opt.sort.push([k, sortobj[k]]);
                                            }
                                        }
                                        if (false == helper.isNullOrUndefined(skipnum)) {
                                            opt.skip = skipnum;
                                        }
                                        if (false == helper.isNullOrUndefined(limitnum)) {
                                            opt.limit = limitnum;
                                        }
                                        //helper.log("[dismdbmgr:find] opt:", opt);
                                        let ef = r_col.find(findobj, opt);
                                        //helper.log("ef id:", ef);
                                        ef = await ef.explain();
                                        helper.log("[dismdbmgr:find] ef:", ef);
                                    }

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
                                    //let cnt = await f.count();
                                    //helper.log("cnt:", cnt);
                                    //helper.log("f id:", f);
                                    f.maxTimeMs(10000);
                                    f.batchSize(1000);
                                    f.toArray((e_find,r_find)=>{
                                        if (e_find) {
                                            helper.logRed("[dismdbmgr:find] col(",u,dbname,colname,").find(...) e_find:", e_find.message);
                                            reject(e_find);
                                        } else {
                                            helper.logGreen("[dismdbmgr:find] col(",u,dbname,colname,").find(...) r_find:", r_find.length);
                                            resolve(r_find);
                                        }
                                    });
                                    
                                    /*let r_cols = [];
                                    f.forEach((r_each)=>{
                                        r_cols.push(r_each);
                                    }, (e_each)=>{
                                        if (e_each) {
                                            helper.logRed("[dismdbmgr:find] col(",u,dbname,colname,").find(...) e_each:", e_each.message);
                                            reject(e1);
                                        } else {
                                            helper.logGreen("[dismdbmgr:find] col(",u,dbname,colname,").find(...) r_cols:", r_cols.length);
                                            resolve(r_cols);
                                        }
                                    });*/
                                    //let r_find = await f.toArray().catch(e_find=>{
                                    //    helper.logRed("[dismdbmgr:find] col(",u,dbname,colname,").find(...) e_find:", e_find.message);
                                    //    reject(e_find);
                                    //});
                                    //helper.logGreen("[dismdbmgr:find] col(",u,dbname,colname,").find(...) r_find:", r_find.length);
                                    //if (false == helper.isNullOrUndefined(r_find)) {
                                    //    resolve(r_find);
                                    //}
                                    /*f.on("close", (e)=>{
                                        helper.log("close e:", e);
                                    });
                                    f.on("data", (e)=>{
                                        helper.log("data e:", e);
                                    });
                                    f.on("end", (e)=>{
                                        helper.log("end e:", e);
                                    });
                                    f.on("readable", (e)=>{
                                        helper.log("readable e:", e);
                                    });*/
                                }
                            });
                        }
                    }
                }));
            });
        });
        helper.log("[dismdbmgr:find] pms:", pms.length);
        Promise.all(pms).then(rs=>{
            let res = [];
            rs.forEach((r)=>{
                res = res.concat(r);
            });
            
            callback(null, res);

        }).catch(e=>{
            helper.logRed("[dismdbmgr:find] e:", e.message);
            callback(e);
        });
    }
    getDb(url, dbname) {
        //helper.log("[dismdbmgr:getDb] (",url+",",dbname+",",") >>>>>");
        if (helper.isNullOrUndefined(this.db_clients[url])) {
            return null;
        } else {
            return this.db_clients[url].db(dbname);
        }
    }
    makeObjectId(string) {
        return mongodb.ObjectID(string);
    }
    close () {
        helper.log("[dismdbmgr:close] () >>>>>");
        for (let u in this.db_clients) {
            if (false == helper.isNullOrUndefined(this.db_clients[u])) {
                this.db_clients[u].close(true);
                this.db_clients[u] = null;
            }
        }
        this.db_clients = {};
    }
}

module.exports = dismdbmgr;