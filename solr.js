var http = require("http");
var sys = require("sys");


var clients = {}


function toJSON(obj) {
    return obj !== null ? JSON.stringify(obj) : null;
}


function cacheClient(port, host) {
    var key = [port, host];
    var client = clients[key];
    if (client) {
        return client;
    } else {
        return clients[key] = http.createClient(port, host);
    }
}


function buildQS(params) {
    var qs = [];
    for (key in params) {
        var value = params[key];
        if (value) {
            qs.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
        } else {
            qs.push(encodeURIComponent(key));
        }
    }
    return qs.join("&");
}


var Solr = function(url) {
    this.host = "127.0.0.1";
    this.port = 8983;
    this.path = "/solr";
    this.debug = true;
}
Solr.prototype = {
    request: function(method, path, params, options) {
        var client = cacheClient(this.port, this.host);
        params["wt"] = "json"
        var path = this.path + path + "?" + buildQS(params);
        if (this.debug) {
            sys.puts("Solr.request START: " + method + " " + toJSON(path));
        }
        // @@@ this feels like a bug. i'd think node would at least do this
        // much for me.
        headers = [
            ["Host", this.host + ":" + this.port.toString()],
        ]
        var request = client.request("GET", path, headers);
        request.finish(function(response) {
            var data = "";
            response.setBodyEncoding("utf8");
            response.addListener("body", function(chunk) {
                data += chunk;
            });
            response.addListener("complete", function() {
                if (this.debug) {
                    sys.puts("Solr.request COMPLETE: " + data);
                }
                data = JSON.parse(data);
                if (options.success) {
                    options.success(data);
                }
            });
        });
    },
    search: function(q, callback) {
        params = {
            q: q
        }
        this.request("GET", "/select/", params, {
            success: function(data) {
                callback(data["response"]);
            }
        });
    }
}


exports.Solr = Solr;