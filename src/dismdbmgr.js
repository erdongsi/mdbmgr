// 支持 单个/多个 分布式 mongodb 服务， （非主从模式）
// 多个 mongodb 服务是单独服务
// 例如 把 一批 数据 随即分别 保存在 一组mongodb服务中，可以 查询 这一组 mongodb服务中的数据。
// 暂时 只支持 查询 find 功能

const mongodb = require("mongodb");

const helper = require("../utils/helper");

class dismdbmgr {
    constructor() {
        this.db_clients = {};
    }
    // urls: [127.0.0.1:10001, 127.0.0.1:10002, ...]
    // callback(error, clients)
    // authinfo: {user:'abcd', password:'123456', authMechanism:'DEFAULT', authSource:'admindb'}
    // authMechanism: DEFAULT, SCRAM-SHA-1, MONGODB-CR, X509, ...
    init(urls, callback, authinfo) {
        helper.log("[disdbmgr:init] (",urls+",","callback,",authinfo,") >>>>>");

        let pms = [];
        urls.forEach((u)=>{
            pms.push(new Promise((resolve,reject)=>{
                let s = "mongodb://";
                if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.user) && false==helper.isNullOrUndefined(authinfo.password)) {
                    s += (encodeURIComponent(authinfo.user) + ":" + encodeURIComponent(authinfo.password) + "@");
                }
                s += (u+"/?");
                if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.authMechanism)) {
                    s += ("&authMechanism=" + authinfo.authMechanism);
                }
                if (false==helper.isNullOrUndefined(authinfo) && false==helper.isNullOrUndefined(authinfo.authSource)) {
                    s += ("&authSource=" + authinfo.authSource);
                }
                s += "&readPreference=secondaryPreferred";
                helper.log("[disdbmgr:init] s:", s);
                let client = new mongodb.MongoClient(s, {useNewUrlParser:true});
                client.connect((e_con)=>{
                    if (e_con) {
                        helper.logRed("[disdbmgr:init] e_con:", e_con.message);
                        reject(e_con);
                    } else {
                        helper.log("[disdbmgr:init] client.connect success.");
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
                        helper.logRed("[disdbmgr:init] e_adm:", e_adm.message);
                    } else {
                        //helper.log("[disdbmgr:init] r_adm:", r_adm);
                        r_adm.databases.forEach((d)=>{
                            //this.db_clients[r.u].db(d.name).collections((e_cols,r_cols)=>{
                            //    if (e_cols) {
                            //        helper.logRed("[disdbmgr:init]", d.name, "e_cols:", e_cols.message);
                            //    } else {
                            //        helper.log("[disdbmgr:init]", d.name, "r_cols:", r_cols.length);
                            //    }
                            //});
                            this.db_clients[r.u].db(d.name).listCollections().toArray((e_lstc,r_lstc)=>{
                                if (e_lstc) {
                                    helper.logRed("[disdbmgr:init]", d.name, "e_lstc:", e_lstc.message);
                                } else {
                                    helper.log("[disdbmgr:init]", d.name, "r_lstc:", r_lstc.length);
                                }
                            });
                        })
                    }
                });
            });
            callback(null, rs);
        }).catch(e=>{
            helper.logRed("[disdbmgr:init] e:", e.message);
            callback(e);
        });
    }
    // callback(error, collections)
    collections(urls, dbname, callback) {
        helper.log("[disdbmgr:collections] (",urls+",",dbname+",","callback) >>>>>");

        if (helper.isNullOrUndefined(urls)) {
            urls = [];
            for (let c in this.db_clients) { urls.push(c); }
        }

        let pms = [];
        urls.forEach((u)=> {
            pms.push(new Promise((resolve,reject)=>{
                if (helper.isNullOrUndefined(this.db_clients[u])) {
                    helper.logRed("[disdbmgr:collections] client(",u,") is null.");
                    reject(new Error("client("+u+") is null."));
                } else if (helper.isNullOrUndefined(this.db_clients[u].db(dbname))) {
                    helper.logYellow("[disdbmgr:collections] db(",u,dbname,") is null.");
                    resolve([]);
                } else {
                    if (false == this.db_clients[u].isConnected()) {
                        //helper.logRed("[disdbmgr:collections] this.db_clients[",u,"] is connected:", this.db_clients[u].isConnected());
                        reject(new Error("client("+u+") is disconnected."));
                    } else {
                        this.db_clients[u].db(dbname).collections((e_cols, r_cols)=>{
                            if (e_cols) {
                                helper.logRed("[disdbmgr:collections] db(",u,dbname,").collections() e_cols:", e_cols.message);
                                reject(e_cols);
                            } else {
                                helper.log("[disdbmgr:collections] get db done.");
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
            
            callback(null, res);

        }).catch(e=>{
            helper.logRed("[disdbmgr:collections] e:", e.message);
            callback(e);
        });
    }
    // callback(error, documents)
    find(urls, dbs, colname, findobj, keyobj, sortobj, skipnum, limitnum, callback) {
        helper.log("[disdbmgr:find] (",urls+",",dbs+",",colname+",",JSON.stringify(findobj)+",",JSON.stringify(keyobj)+",",(helper.isNullOrUndefined(sortobj)?"null":JSON.stringify(sortobj))+",",skipnum+",",limitnum+",","callback) >>>>>");

        if (helper.isNullOrUndefined(urls)) {
            urls = [];
            for (let c in this.db_clients) { urls.push(c); }
        }

        let pms = [];
        urls.forEach((u)=> {
            dbs.split(',').forEach((dbname)=>{
                pms.push(new Promise((resolve,reject)=>{
                    if (helper.isNullOrUndefined(this.db_clients[u])) {
                        helper.logRed("[disdbmgr:find] client(",u,") is null.");
                        reject(new Error("client("+u+") is null."));
                    } else if (helper.isNullOrUndefined(this.db_clients[u].db(dbname))) {
                        //helper.logGreen(this.db_clients[u]);
                        helper.logYellow("[disdbmgr:find] db(",u,dbname,") is null.");
                        resolve([]);
                    } else {
                        if (false == this.db_clients[u].isConnected()) {
                            //helper.logRed("[disdbmgr:find] this.db_clients[",u,"] is connected:", this.db_clients[u].isConnected());
                            reject(new Error("client("+u+") is disconnected."));
                        } else {
                            this.db_clients[u].db(dbname).collection(colname, {safe:true}, (e_col, r_col)=>{
                                if (e_col) {
                                    helper.logRed("[disdbmgr:find] db(",u,dbname,").collection(",colname,") e_col:", e_col.message);
                                    reject(e_col);
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
                                    f.toArray((e_find,r_find)=>{
                                        if (e_find) {
                                            helper.logRed("[disdbmgr:find] col(",u,dbname,colname,").find(...) e_find:", e_find.message);
                                            reject(e_find);
                                        } else {
                                            helper.logGreen("[disdbmgr:find] col(",u,dbname,colname,").find(...) r_find:", r_find.length);
                                            resolve(r_find);
                                        }
                                    });
                                }
                            });
                        }
                    }
                }));
            });
        });

        Promise.all(pms).then(rs=>{
            let res = [];
            rs.forEach((r)=>{
                res = res.concat(r);
            });
            
            callback(null, res);

        }).catch(e=>{
            helper.logRed("[disdbmgr:find] e:", e.message);
            callback(e);
        });
    }
    getDb(url, dbname) {
        helper.log("[disdbmgr:getDb] (",url+",",dbname+",",") >>>>>");
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
        helper.log("[disdbmgr:close] () >>>>>");
        for (let u in this.db_clients) {
            if (helper.isNullOrUndefined(this.db_clients[u])) {
                this.db_clients[u].close();
                delete this.db_clients[u];
            }
        }
        this.db_clients = {};
    }
}

module.exports = dismdbmgr;