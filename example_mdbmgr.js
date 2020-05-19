const path = require("path");

const helper = require("./utils/helper");
const cmd = require("./utils/cmd");
const logs = require("./utils/logs");

const dismdbmgr = require("./src/dismdbmgr");

const mycmd = require("./mycmd");

logs.getInst().setID("example_mdbmgr",2);

// 0.make mycmd
cmd.start(mycmd.doCmd);

let auth_info = {user:"reader",password:"reader'spassworld",authMechanism:"DEFAULT",authSource:"authSourceDatabase"};
let urls = ["localhost:27017","localhost2:27018"]

let dismod = new dismdbmgr();
dismod.init(urls, (e,r)=>{
    if (e) {
        helper.logRed("[disdblogs] e:", e.message);
    } else {
        helper.logGreen("[disdblogs] connect",urls,"success.");

        let sort = {_id:1};    //null
        let skip = 0;            //null
        let limit = 10;        //null
        let db_name = "db_name";
        let col_name = "col_name";
        let query = {};
        let projection = {};

        dismod.find(null, db_name, col_name, query, projection, sort, skip, limit, (e_find, r_find)=>{
            if (e_find) {
                helper.logRed("[disdblogs] disdbmgr.find() e_find:", e_find.message);
                m.error = e_find.message;
            } else {
                helper.log("[disdblogs] disdbmgr.find() r_find:", r_find.length);
                r_find.forEach((f,i)=>{
                    helper.log(i, f._id);
                });
            }
        });
    }
}, auth_info);
