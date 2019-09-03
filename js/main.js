require([
  "esri/Map",
  "esri/views/MapView",
  "esri/widgets/Home",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/layers/FeatureLayer",
  "esri/request",
  "esri/geometry/Point",
  "esri/geometry/SpatialReference",
  "esri/widgets/Search",
  "esri/widgets/Expand",
  "esri/geometry/geometryEngine",
  "esri/geometry/Multipoint",
  "esri/tasks/Locator",
  "esri/geometry/Extent",
  "esri/widgets/Zoom",
  "esri/widgets/LayerList"
], function(
  Map,
  MapView,
  Home,
  GraphicsLayer,
  Graphic,
  FeatureLayer,
  esriRequest,
  Point,
  SpatialReference,
  Search,
  Expand,
  geometryEngine,
  Multipoint,
  Locator,
  Extent,
  Zoom,
  LayerList
) {

  //Create the map
  var map = new Map({
    basemap: "dark-gray-vector"
  });

  //Create the different graphics layers
  var resultingLayer = new GraphicsLayer();
  var searchLayer = new GraphicsLayer();
  var stationGraphics = new GraphicsLayer();
  stationGraphics.title = "BCycle Stations";
  resultingLayer.listMode = "hide";
  searchLayer.listMode = "hide";
  map.addMany([resultingLayer, searchLayer, stationGraphics]);

  //Add a bikeways layer
  var bikeways = new FeatureLayer({
    url: "https://gis.h-gac.com/arcgis/rest/services/Ped_Bike/Existing_Bikeways/MapServer/0",
    visible: false
  });
  map.add(bikeways);

  //Add the view
  var view = new MapView({
    map: map,
    container: "viewDiv",
    center: [-95.381214, 29.742862],
    zoom: 11,
    popup: {
      actionsMenuEnabled: false
    }
  });
  view.ui.remove("zoom");

  //Add a Home button
  var homeWidget = new Home({
    view: view
  });

  //Add the zoom buttons
  var zoom = new Zoom({
    view: view
  });

  //Create a Search widget
  var searchWidget = new Search({
    view: view,
    autoNavigate: false,
    popupEnabled: false,
    resultGraphicEnabled: false,
    includeDefaultSources: false,
    sources: [{
        locator: new Locator({
            url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
        }),
        singleLineFieldName: "SingleLine",
        outFields: ["Addr_type"],
        searchExtent: new Extent({
            xmax: -97.292800,
            ymax: 30.797600,
            xmin: -93.236100,
            ymin: 28.460500
        }),
        placeholder: "3555 Timmons Ln, Houston, TX"
    }]
  });

  var searchButton = new Expand({
    expandIconClass: "esri-icon-search",
    expandTooltip: "Search for an address",
    view: view,
    content: searchWidget,
    mode: "floating",
    group: "top-left"
  });

  //Create the LayerList and the button for the LayerList
  var layerWidget = new LayerList({
    view: view
  });

  var layerButton = new Expand({
    expandIconClass: "esri-icon-layer-list",
    expandTooltip: "View the Layers",
    view: view,
    content: layerWidget,
    mode: "floating",
    group: "top-left"
  });

  //Event listener to activate once the search widget has a result
  searchWidget.on("select-result", function(evt){
    resultingLayer.removeAll();
    searchLayer.removeAll();
    closestStation(evt.result.feature.geometry, stationGraphics);
  });

  //Event listener to remove graphics when the search is cleared
  searchWidget.on("search-clear", function(evt){
    searchLayer.removeAll();
    resultingLayer.removeAll();
  })

  //Function to get closest Bcycle station to the searched point
  function closestStation(point, stationGraphics){
    var searchedPoint = {
      type: "point",
      x: point.longitude,
      y: point.latitude
    };

    //Symbology for the searched point
    var searchedSymbol = {
      type: "simple-marker",
      style: "diamond",
      color: [255,0,0,1],
      size: 12,
      outline: {
        width: 0.5,
        color: [255,0,0,0.5]
      }
    };

    //The point graphic showing the searched address
    var searchedPointGraphic = new Graphic({
      geometry: searchedPoint,
      symbol: searchedSymbol
    });

    //Add the graphic to the map
    searchLayer.add(searchedPointGraphic);

    //Search for the closest Bcycle station
    var pointObject = new Point({
      latitude: searchedPoint.y,
      longitude: searchedPoint.x
    });

    //Create a multipoint feature in order to find the bcycle station closest to the searched point
    var multipointTest = new Multipoint(new SpatialReference(4326));

    //Take all of the stations and append them to the multipoint feature
    stationGraphics.graphics.forEach(function(graphic){
      multipointTest.addPoint(graphic.geometry);
    });

    //Run the nearest coordinate tool to find the closest station
    var bcycleStation = geometryEngine.nearestCoordinate(multipointTest, pointObject);

    //Style the result so that it stands out for the user
    var polySym = {
      type: "picture-marker",
      url: "https://arcgis.github.io/arcgis-samples-javascript/sample-data/cat5.png",
      width: 50,
      height: 50,
      angle: 0
    };

    //Add the result to the buffer graphics layer which will display on the map
    resultingLayer.add(
      new Graphic({
        geometry: bcycleStation.coordinate,
        symbol: polySym
      })
    );

    //Once the result is added to the map zoom the map view to the result
    view.goTo({
      target: bcycleStation.coordinate,
      zoom: 14
    });
  }

  //Use esriRequest to get the Bcycle stations and display them on the map
  esriRequest("https://gbfs.bcycle.com/bcycle_houston/station_information.json",{
    responseType: "json"
  }).then(function(response){
    response.data.data.stations.map(function(stationInfo){
      //Create the point geometry
      var point = {
        type: "point",
        x: stationInfo.lon,
        y: stationInfo.lat
      };

      //Create the point symbology
      var pointSymbol = {
        type: "simple-marker",
        color: "#008000",
        size: 5,
        outline: {
          width: 0.5,
          color: "#004000"
        }
      };

      //Use esriRequest to get information about the bcycle stations and join it based on the station_id
      esriRequest("https://gbfs.bcycle.com/bcycle_houston/station_status.json",{
        responseType: "json"
      }).then(function(response){
        response.data.data.stations.map(function(info){
          if (stationInfo.station_id == info.station_id){
            var pointAttributes2 = {
              station_id: stationInfo.station_id,
              name: stationInfo.name,
              address: stationInfo.address,
              latitude: stationInfo.lat,
              longitude: stationInfo.lon,
              bikes_available: info.num_bikes_available,
              docks_available: info.num_docks_available
            };

            var test = new Graphic({
              geometry: point,
              symbol: pointSymbol,
              attributes: pointAttributes2,
              popupTemplate: {
                title: "{name}",
                content: [{
                  type: "text",
                  text: "{name} is located at {address} and has a Lat/Long of {latitude}, {longitude}. Currently, {name} has {bikes_available} bikes available and {docks_available} docks available."
                }]
              }
            });
            stationGraphics.add(test);
          }
        });
      });

    });
  });

  //Create a dialog box when click the info button
  //Create a jQuery UI dialog box
  var dialog = $("#dialog").dialog({
    autoOpen: false,
    height: "auto",
    width: "auto",
    modal: true,
    fluid: true,
    position: {
      my: "center center",
      at: "center center",
      of: "#wrapper"
    },
    buttons: {
      "Close": function(){
        dialog.dialog("close");
      }
    }
  });

  //Click the about button to open the dialog
  $(".about").on("click", function(e){
    dialog.dialog("open");
  });

  //Determine where to place the widgets
  isResponsiveSize = view.widthBreakpoint === "xsmall";
  updateView(isResponsiveSize);

  //Watch for Breakpoints
  view.watch("widthBreakpoint", function(breakpoint){
      switch(breakpoint){
          case "xsmall":
          case "small":
              updateView(true);
              break;
          case "medium":
          case "large":
          case "xlarge":
              updateView(false);
              break;
          default:
      }
  });

  //Functions to determine the screen size
  function updateView(isMobile){
    setMobileWidgets(isMobile);
  }

  function setMobileWidgets(isMobile){
    if (isMobile){
      view.ui.add(zoom, "bottom-right");
      view.ui.add(homeWidget, "bottom-right");
      view.ui.add(layerButton, "top-right");
      view.ui.add(searchWidget, "bottom-right");
      view.ui.remove(searchButton);
    } else {
      view.ui.add(zoom, "top-left");
      view.ui.add(homeWidget, "top-left");
      view.ui.add(searchButton, "top-left");
      view.ui.add(layerButton, "top-left");
      view.ui.remove(searchWidget);
    }
  }

});
