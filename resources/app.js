//require("!style!css!./css/style.css");
//var d3 = require('d3');
//var turf = require('turf');

var q = function(item) {
  var svalue = location.search.match(
    new RegExp("[?&]" + item + "=([^&]*)(&?)", "i")
  );
  return svalue ? svalue[1] : svalue;
};

//detecting language
var detectLang = function() {
  var tlang = "en";
  if (q("l") === "ru" || q("l") === "ru/") {
    tlang = "ru";
  } else {
    var dlang = navigator.language || navigator.userLanguage;
    if (dlang == "ru" || dlang == "ru-RU") tlang = "ru";
  }
  return tlang;
};

var lang = detectLang();
var ll;

//console.log(q("ll"));
if (q("ll")) {
  ll = q("ll").split(",");
}

//main configuration
c = {
  ll: ll ? [+ll[0], +ll[1]] : [37.63019, 55.756389], //galton's starting point && center of the map on start
  zoom: q("zoom") ? +q("zoom") : 13,
  time: q("time") ? +q("time") : 30,
  city: q("city") ? q("city") : "moscow", //current city
  mode: q("mode") ? q("mode") : "foot",
  page: q("page") ? q("page") : "about", //current page in the panel
  lang: detectLang()
};

var cities = [
  { id: "moscow", center: [37.63019, 55.756389], ru: "Москва", en: "Moscow" }
];


var modes = [
  { id: "foot", ru: "Пешком", en: "Walking" },
  { id: "masstransit", ru: "Транспорт", en: "Public transit" },
  { id: "car", ru: "Автомобиль", en: "Driving" }
];

//URL request params
var galtonUrl = "https://galton.urbica.co/",
    otpUrl = 'http://178.132.206.5/api/isochrones/';

//http://178.132.206.5/api/isochrones/?lng=37.6544718891561&lat=55.741775189814746&network=current&timeOfDay=morning&travelTime=15

//blocks
var modesList = d3.select("#modes"),
  menu = d3.select("#menu"),
  progress = d3.select("#progress"),
  content = d3.select("#content"),
  locationBtn = d3.select("#location-btn"),
  stats = d3.select("#stats"),
  sliderValue = d3.select("#slider-value").text(c.time  + " mins"),
  slider = d3.select("#slider").property("value", c.time)
    .on("input", () => {
    c.time = document.getElementById("slider").value;
    console.log(c.time);
    sliderValue.text(c.time + " mins");
    getGalton(c.ll, c.mode, c.city, c.time)
  });

//ajust content-height in the panel
//var panelBox = d3.select("#about").node().getBoundingClientRect();
//console.log(panelBox);

locationBtn.on("click", function() {
  progress.style("display", "block");
  navigator.geolocation.getCurrentPosition(function(position) {
    console.log([position.coords.longitude, position.coords.latitude]);
    setParam("ll", [position.coords.longitude, position.coords.latitude]);

    //what if the location far away from city, looking for nearest city
    var currentCity = cities.find(function(city) {
        return city.id == c.city;
      }),
      distance = turf.distance(
        turf.point(c.ll),
        turf.point(currentCity.center),
        "kilometers"
      );

    //sort cities by distance
    cities.sort(function(a, b) {
      var d =
        turf.distance(turf.point(c.ll), turf.point(a.center), "kilometers") -
        turf.distance(turf.point(c.ll), turf.point(b.center), "kilometers");
      return d;
    });

    //setting nearest city
    if (c.city !== cities[0].id) {
      d3.select("#" + cities[0].id).attr("class", "city-selected");
      d3.select("#" + c.city).attr("class", "city");
      setParam("city", cities[0].id);
    }

    map.setCenter(c.ll);
    getGalton(c.ll, c.mode, c.city, c.time);
  });
});

//modes list
modes.forEach(function(m) {
  modesList
    .append("div")
    .attr("class", m.id == c.mode ? "mode-selected" : "mode")
    .attr("id", m.id)
    .text(m[c.lang])
    .on("click", function() {
      changeMode(m.id);
    });
});

function setContentHeight(wheight) {
  if (wheight < 510) {
    content.style("height", wheight - 140 + "px");
  }
}



function updateURLParams() {
  var u = "./?",
    t;
  for (i in c) {
    u += "&" + i + "=" + c[i];
  }
  window.history.pushState(null, "Galton", u);
}

function setParam(key, value) {
  c[key] = value;
  updateURLParams();
}

//setPage(c.page);
//setLang(c.lang);
updateURLParams();

var startPoint = turf.featureCollection([turf.point(c.ll)]),
  isDragging,
  isCursorOverPoint,
  args = location.search
    .replace(/^\?/, "")
    .split("&")
    .reduce(function(o, param) {
      var keyvalue = param.split("=");
      o[keyvalue[0]] = keyvalue[1];
      return o;
    }, {});

function changeMode(m) {
  d3.select("#" + c.mode).attr("class", "mode");
  d3.select("#" + m).attr("class", "mode-selected");
  getGalton(c.ll, m, c.city, c.time);
}

mapboxgl.accessToken =
  "pk.eyJ1IjoidXJiaWNhIiwiYSI6ImNpbnlvMXl4bDAwc293ZGtsZjc3cmV1MWYifQ.ejYUpie2LkrVs_dmQct1jA";

var map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/urbica/cirlzq8g90016gxlz0kijgiwf",
    center: c.ll,
    zoom: c.zoom,
    minZoom: 8
  }),
  canvas = map.getCanvasContainer();

//start
//setCity(c.city);

var layers = [
  { time: 20, color: "#0af", opacity: 0.4 },
  { time: 10, color: "#0af", opacity: 0.6 }
];

function mouseDown(e) {
  if (!isCursorOverPoint) return;

  isDragging = true;

  // Set a cursor indicator
  canvas.style.cursor = "grab";

  // Mouse events
  map.on("mousemove", onMove);
  map.on("mouseup", onUp);
}

function onMove(e) {
  if (!isDragging) return;
  var coords = e.lngLat;
  // Set a UI indicator for dragging.
  canvas.style.cursor = "grabbing";

  // Update the Point feature in `geojson` coordinates
  // and call setData to the source layer `point` on it.
  startPoint.features[0].geometry.coordinates = [coords.lng, coords.lat];
  map.getSource("start").setData(startPoint);
}

function onUp(e) {
  if (!isDragging) return;
  var coords = e.lngLat;
  canvas.style.cursor = "";
  isDragging = false;
  getGalton(startPoint.features[0].geometry.coordinates, c.mode, c.city, c.time);
}

map.on("load", function() {
  //fading out intro
  //  d3.select("#intro").style("opacity", 0);
  setTimeout(function() {
    //    d3.select("#intro").style("display", "none");
  }, 700);

  map.addSource("isochrones", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });
  map.addSource("isochrones-otp", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] }
  });
  map.addSource("start", { type: "geojson", data: startPoint });

  map.on("mousemove", function(e) {
    var features = map.queryRenderedFeatures(e.point, { layers: ["start"] });

    // Change point and cursor style as a UI indicator
    // and set a flag to enable other mouse events.
    if (features.length) {
      //map.setPaintProperty ('start', 'circle-color', '#3366FF');
      canvas.style.cursor = "move";
      isCursorOverPoint = true;
      map.dragPan.disable();
    } else {
      //map.setPaintProperty ('start', 'circle-color', '#0088FF');
      canvas.style.cursor = "";
      isCursorOverPoint = false;
      map.dragPan.enable();
    }
  });

  map.on("mousedown", mouseDown, true);

  map.on("click", function(e) {
    startPoint.features[0].geometry.coordinates = [e.lngLat.lng, e.lngLat.lat];
    map.getSource("start").setData(startPoint);
    getGalton([e.lngLat.lng, e.lngLat.lat], c.mode, c.city, c.time);
  });

  map.on("dragend", function() {
    setParam("center", Math.round(map.getZoom() * 10) / 10);
    //  syncMap("mapbox", map.getCenter().toArray(), map.getZoom());
  });

  map.on("zoomend", function() {
    setParam("zoom", Math.round(map.getZoom() * 10) / 10);
    //  syncMap("mapbox", map.getCenter().toArray(), map.getZoom());
  });

  map.addLayer(
    {
      id: "fill-otp",
      type: "fill",
      source: "isochrones-otp",
      layout: {},
      paint: {
        "fill-color": "#00AADD",
        "fill-opacity": 0.6
      }
    },
    "road-path"
  );

  map.addLayer(
    {
      id: "isochrone-fill",
      type: "fill",
      source: "isochrones",
      layout: {},
      paint: {
        "fill-color": "#0af",
        "fill-opacity": 0.7
      }
    },
    "road-path"
  );

  map.addLayer({
    id: "isochrone-line",
    type: "line",
    source: "isochrones",
    layout: {},
    paint: {
      "line-color": "#0af",
      "line-opacity": 1,
      "line-width": 0.3
    }
  });

  map.addLayer({
    id: "start-border",
    type: "circle",
    source: "start",
    paint: {
      "circle-radius": 16,
      "circle-color": "#FFF",
      "circle-opacity": 0.8
    }
  });

  map.addLayer({
    id: "start",
    type: "circle",
    source: "start",
    paint: {
      "circle-radius": 12,
      "circle-color": "#555"
    }
  });

  //start app
  getGalton(c.ll, c.mode, c.city, c.time);
});

makeUrl = (coords, mode, city, time) => {
  var url = '';

  if(mode === "masstransit") {
    ////http://178.132.206.5/api/isochrones/?lng=37.6544718891561&lat=55.741775189814746&network=current&timeOfDay=morning&travelTime=15
    url = otpUrl +
    "/?lng=" +
    coords[0] +
    "&lat=" +
    coords[1] +
    '&network=current&timeOfDay=morning&travelTime='+time;
  } else {
    url = galtonUrl +
    city +
    "/" +
    mode +
    "/?lng=" +
    coords[0] +
    "&lat=" +
    coords[1] +
    "&intervals="+time;
  }

  console.log(url);
  return url;


}


getGalton = (coords, mode, city, time) => {
  if (!city) city = c.city;
  //change city scenario
  if (city !== c.city) {
    d3.select("#" + c.city).attr("class", "city");
    d3.select("#" + city).attr("class", "city-selected");
    map.setCenter(coords);
    setParam("city", city);
  }

  if (!mode) mode = "foot";

  progress.style("display", "block");
  setParam("ll", coords);

  //update time
  setParam("time", time);

  var url = makeUrl(coords,mode,city,time);

  console.log(url);

  if (mode == "car") {
    url += "&radius=100&cellSize=0.8";
  } else {
    url += "&radius=5&cellSize=0.07";
  }

  startPoint.features[0].geometry.coordinates = coords;
  map.getSource("start").setData(startPoint);

  console.time('request');
  d3.json(url, function(data) {
      setParam("mode", mode);
    //if mode was changed
    //if (mode !== c.mode) {
    //  map.flyTo({ center: coords, zoom: mode == "foot" ? 13 : 9 });
      setParam("mode", mode);
    //}

    map.getSource("isochrones").setData(data);

    console.timeEnd('request');
    // if(mode === "masstransit") {
    //   map.getSource("isochrones-otp").setData(data);
    //   map.getSource("isochrones").setData({ type: "FeatureCollection", features: [] });
    // } else {
    //   map.getSource("isochrones").setData(data);
    //   map.getSource("isochrones-otp").setData({ type: "FeatureCollection", features: [] });
    // }
    console.log(data);
    progress.style("display", "none");

    //      var stationsWithin = turf.within(stations, data);
    //      stats.text(stationsWithin.features.length + ' noise complaints')
  });
}
