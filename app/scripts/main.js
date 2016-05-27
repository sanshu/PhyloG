var viewer = new Cesium.Viewer('cesiumContainer');
var pinBuilder = new Cesium.PinBuilder();

var countries = {};
var strains = {};
var tree = {};
var minElevation = 100;
var scaleFactor = 5000000;


var entities = viewer.entities;
var ptree = entities.add(new Cesium.Entity());
var pins = entities.add(new Cesium.Entity());

$.ajax({
    type: 'GET',
    url: 'data/countries.csv',
    dataType: 'text',
    success: function (data) {
        //https://developers.google.com/public-data/docs/canonical/countries_csv
        var carray = $.csv.toObjects(data);
        carray.forEach(function (c) {
            countries[c.name] = {lat: c.latitude, lon: c.longitude};
        });
        console.log('Loaded geo data');
        loadMetaData();
    }
});

function loadMetaData() {
    $.ajax({
        type: 'GET',
        url: 'data/zikaNS5.txt',
        dataType: 'text',
        success: function (data) {
            processDatapoints(data);
            console.log('Loaded meta data');
            loadTree();
        }
    });
}

function loadTree() {
    $.ajax({
        type: 'GET',
        url: 'data/zikaNS5.nwk',
        dataType: 'text',
        success: function (data) {
            var tree = parseNewick(data);
            console.log(tree);
            console.log('Loaded tree data');
        }
    });
}


function processDatapoints(csv) {
    var header = '"Accession","Length","Country","Host","Date","Unkn","CollectionDate","Definition","gi","GenomeRegion"';
    console.log('required metadata header:\n' + header);
    var datapoints = $.csv.toObjects(header + '\n' + csv);//, {delimiter:" ", separator:"\t"});
    datapoints.forEach(function (d) {
        var c = countries[d.Country];
        if (c === null) {
            console.log('Unable to determine location lat:lon for ' + d.Country + '. Will use 0:0');
            d.lat = 0;
            d.lon = 0;
        } else {
            d.lat = c.lat;
            d.lon = c.lon;
        }
        strains[d.Accession] = d;
        addPin(d);
    });
//    console.log(datapoints);
}

function addPin(d) {

//    var entity = entities.add({
//        parent: pins,
//        position: Cesium.Cartesian3.fromDegrees(d.lon, d.lat),
//        label: {
//            text: d.Country,
//            verticalOrigin: Cesium.VerticalOrigin.TOP
//        },
//        billboard: {
//            image: pinBuilder.fromColor(Cesium.Color.RED, 24).toDataURL(),
//            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
//        }
//    });
}


function parseNewick(newick) {
    var t = new Tree();
    newick = newick.trim(newick).replace(/ /g, '');
    t.Parse(newick);
    if (t.error !== 0)
    {
        console.log('Error parsing tree');
    } else
    {
        t.ComputeDepths();
        assignCoordinates(t.root);
        draw(t);
    }

    return t;
}

function assignCoordinates(node) {
    if (node.xyz) {
        return node.xyz;
    }

    if (node.IsLeaf()) {
        var strain = strains[node.label];
        node.xyz = strain === null ? [0, 0, minElevation] : [parseFloat(strain.lat), parseFloat(strain.lon), minElevation + node.edge_length * scaleFactor];

    } else {
        var left = assignCoordinates(node.child);
        var right = assignCoordinates(node.child.sibling);
        node.xyz = [(left[0] + right[0]) / 2,
            (left[1] + right[1]) / 2,
            Math.max(parseFloat(left[2]) + parseFloat(right[2])) + node.edge_length * scaleFactor];
//        console.log("left: " + left + ", right: " + right + " node: " + node.xyz);
    }
    return node.xyz;
}



function draw(tree) {

    drawEdges(tree.root, tree.root.depth);
    tree.nodes.forEach(function (n) {
        if (n.IsLeaf()) {
            var entity = entities.add({
                parent: ptree,
                position: Cesium.Cartesian3.fromDegrees(n.xyz[1], n.xyz[0], n.xyz[2]),
                label: {
                    text: n.label,
                    font: '14pt monospace',
                    verticalOrigin: Cesium.VerticalOrigin.TOP
                },
                billboard: {
                    image: pinBuilder.fromColor(Cesium.Color.GREEN, 28).toDataURL(),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM
                }
            });
        } else {
            var entity = entities.add({
                parent: ptree,
                position: Cesium.Cartesian3.fromDegrees(n.xyz[1], n.xyz[0], n.xyz[2]),
                point: {
                    color: Cesium.Color.BLUE,
                    pixelSize: 6
                }
            });
        }
    });


    ptree.show = true;


//viewer.dataSources.add(Cesium.GeoJsonDataSource.load('data/world-topo.json'));

}


function drawEdges(node, maxdepth) {
    if (node === null)
        return;

    if (node.child) {
        drawEdges(node.child, maxdepth);
        drawEdges(node.child.sibling, maxdepth);
    }

    var edgeColor = Cesium.Color.BLUE.brighten(1 - 100 * node.depth / maxdepth, new Cesium.Color());

    var parent = node.ancestor;
    if (parent) {
        var line = viewer.entities.add({
            parent: ptree,
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArrayHeights([node.xyz[1], node.xyz[0], node.xyz[2],
                    parent.xyz[1], parent.xyz[0], parent.xyz[2]]),
                width: 3,
                material: edgeColor
            }
        });
    } else {
        var line = viewer.entities.add({
            parent: ptree,
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArrayHeights([node.xyz[1], node.xyz[0], node.xyz[2],
                    node.xyz[1], node.xyz[0], node.xyz[2] + scaleFactor/10]),
                width: 3,
                material: edgeColor
            }
        });
    }
}



//
//var PhyloG = {};
//
//PhyloG.addToolbarMenu([{
//        text: 'All flu cases',
//        onselect: function () {
//            viewer.camera.flyHome(0);
//            viewer.dataSources.add(Cesium.KmlDataSource.load('../../SampleData/ge/all.kml', options));
//        }
//    },
//    {text: 'human h5n1_he',
//        onselect: function () {
//            viewer.camera.flyHome(0);
//            viewer.dataSources.add(Cesium.KmlDataSource.load('../../SampleData/ge/human_h5n1_HE.kml', options));
//        }
//    }, {text: 'human h5n1_NA',
//        onselect: function () {
//            viewer.camera.flyHome(0);
//            viewer.dataSources.add(Cesium.KmlDataSource.load('../../SampleData/ge/human_h5n1_NA.kml', options));
//        }
//    }, ], 'toolbar');
//
//PhyloG.reset = function () {
//    viewer.dataSources.removeAll();
//    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
//    viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
//};
