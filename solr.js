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
    // @@@ parse host, port and path from url
    this.host = "127.0.0.1";
    this.port = 8983;
    this.path = "/solr";
    this.debug = true;
}
Solr.prototype = {
    request: function(method, path, options) {
        var debug = this.debug; // this is overridden in some callbacks
        var client = cacheClient(this.port, this.host);
        var path = this.path + path;
        if (options.params) {
            path += "?" + buildQS(options.params);
        }
        if (debug) {
            sys.puts("Solr.request START: " + method + " " + toJSON(path));
        }
        if (options.headers) {
            headers = options.headers;
        } else {
            headers = {};
        }
        // @@@ this feels like a bug. i'd think node would at least do this
        // much for me.
        headers["Host"] = this.host + ":" + this.port.toString();
        var request;
        if (options.body) {
            var body = options.body.toString();
            headers["Content-Length"] = body.length;
            request = client.request(method, path, headers);
            request.sendBody(body, "utf8");
        } else {
            request = client.request("GET", path, headers);
        }
        request.finish(function(response) {
            var data = "";
            response.setBodyEncoding("utf8");
            response.addListener("body", function(chunk) {
                data += chunk;
            });
            response.addListener("complete", function() {
                if (debug) {
                    sys.puts("Solr.request COMPLETE: "+response.statusCode+" "+toJSON(response.headers)+" "+data);
                }
                if (response.statusCode == 200) {
                    data = JSON.parse(data);
                    if (options.success) {
                        options.success(data);
                    }
                }
            });
        });
    },
    search: function(q, callback) {
        params = {
            q: q,
            wt: "json"
        }
        this.request("GET", "/select/", {
            params: params,
            success: function(data) {
                callback(data["response"]);
            }
        });
    },
    add: function(docs) {
        if (this.debug) {
            sys.puts("Solr.add: " + toJSON(docs));
        }
        var xml = [];
        xml.push("<add>");
        for (var i = 0; i < docs.length; i++) {
            var doc = docs[i];
            xml.push("<doc>");
            for (k in doc) {
                xml.push('<field name="'+k+'">'+doc[k].toString()+'</field>');
            }
            xml.push("</doc>");
        }
        xml.push("</add>");
        if (this.debug) {
            sys.puts("Solr.add XML: " + xml.join(""));
        }
        this.request("POST", "/update/", {
            params: {wt: "json"},
            headers: {"Content-Type": "text/xml"},
            body: xml
        })
    }
}


exports.Solr = Solr;