var http = require("http"),
    express = require("express"),
    bodyParser = require("body-parser"),
    mongoose = require("mongoose"),
    url = require("url"),
    app = express(),
    INIT_KEY = 10 * Math.pow(36, 3);

app.set("views", "./views");
app.set("view engine", "jade");
app.use(bodyParser.urlencoded({extended: true}));

// Set up MongoDB
mongoose.connect("mongodb://localhost/urlshortener");
var UrlShortenerSchema = mongoose.Schema({
  short: String,
  long: String,
  count: Number
});
var UrlShortener = mongoose.model("UrlShortener", UrlShortenerSchema);

http.createServer(app).listen(3000);
console.log("Server running on port 3000");

app.get("/", function(req, res) {
  UrlShortener.find({}).sort({count: -1}).limit(10).exec(function (err, docs) {
    res.render("index", {"reply": docs});
  });
});

app.post("/", function(req, res) {
  urlObj = url.parse(req.body.url);
  
  if (urlObj) {
    var pathArray = urlObj.path.split("/");
    var len = pathArray.length;
    if (len > 1) {
      var short = pathArray[len-1];
      // Search for short key
      UrlShortener.findOne({"short": short}, function (err, result) {
        if (err) {
          console.log("There was an error searching for short key.\n"+err);
          res.end("<p>Sorry there was an error searching for the short key.</p>");
        }
        else {
          if (result) {
            // Found short key, so display longUrl
            res.end("<p>Long URL: <a href='" + result.long + "'>" + result.long + "</a></p>");
          }
          else {
            // Short key not found, search for longUrl
            UrlShortener.findOne({"long": urlObj.href}, function (err, result) {
              if (err) {
                console.log("There was an error searching for short key.\n"+err);
                res.end("<p>Sorry there was an error searching for the short key.</p>");
              }
              else {
                if (result) {
                  // Found longUrl, so display shortUrl
                  res.end("<p>Already in database</p><br /><p>Short URL: <a href='http://localhost:3000/" + result.short + "'>http://localhost:3000/" + result.short + "</p>");
                }
                else {
                  // longUrl not found, creating shortened URL
                  shortenUrl(UrlShortener, urlObj, function (err, nextKey) {
                    if (err) {
                      console.log("There was an error creating the shortened URL.\n");
                      res.end("<p>There was an error creating the shortened URL.</p>");
                    }
                    else {
                      res.end("<p>Short URL: <a href='http://localhost:3000/" + nextKey + "'>http://localhost:3000/" + nextKey + "</p>");
                    }
                  });
                }
              }
            });
          }
        }
      });
    }
  }
  else {
   res.end("<p>Please input a valid URL</p>");
  }
});

app.get("/:key", function(req, res) {
  UrlShortener.findOne({"short": req.params.key}, function(err, reply) {
    if (err) {
      console.log("Error finding short key.\n"+err);
    }
    else {
      if (reply) {
        reply.count += 1;
        reply.save();
        res.redirect(reply.long);
      }
      else {
        res.status(404).end("No such shortened URL!");
      }
    }
  });
});

function getNext(mdb, fn) {
  // mdb is the variable name for UrlShortener model in this function
  mdb.findOne({"short": "next"}, function (err, next) {
    if (err) {
      console.log("There was an error querying the db for next" + err);
    }
    else {
      if (next) {
        console.log("next key exists... updating");
        var incr = Math.floor(Math.random()*10) + 1;
        next.long = (parseInt(next.long) + incr).toString();
        next.save(function (err) {
          if (err) {
            console.log("There was an error incrementing next in db.\n"+err);
          }
          else {
            fn(base36encode(parseInt(next.long)));
          }
        });
      }
      else {
        console.log("new NextKey");
        // Entry "next" does not exist, create it
        var newNext = new mdb({"short": "next", "long": INIT_KEY.toString(), "count": 0});
        newNext.save(function (err) {
          if (err) {
            console.log("Error creating first entry for \"next\"\n"+err);
          }
          else {
            fn(base36encode(parseInt(newNext.long)));
          }
        });
      }
    }
  });
}

function base36encode(num) {
  var base36 = "abcdefghijklmnopqrstuvwxyz0123456789";
  var key = "";
  
  while (num > 0) {
    key += base36[num % 36];
    num = Math.floor(num / 36);
  }
  
  return key;
}

function shortenUrl(UrlShortener, urlObj, fn) {
  getNext(UrlShortener, function (nextKey) {
  var shortKey = new UrlShortener({"short": nextKey, "long": urlObj.href, "count": 0});
  shortKey.save(function (err) {
    if (err) {
      fn(-1, null);
    }
    else {
      fn(null, nextKey);
    }
  });
});
}