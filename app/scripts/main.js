(function () {
    'use strict';

    var bingApiKey = 'AmynqN9p9KKkkF7tf-o1Ie1QWB2YSc0x9DqjbS8VuUabJ5Sps4lubTHJ6ieVpb0V'; // non-profit key, might need to change it later

    Cesium.BingMapsApi.defaultKey = bingApiKey;

    var defaultAction;

    /* */
    var PhyloGlobe = {
        addToolbarMenu: function (options, toolbarID) {
            var menu = document.createElement('select');
            menu.className = 'cesium-button';
            menu.onchange = function () {
                PhyloGlobe.reset();
                var item = options[menu.selectedIndex];
                if (item && typeof item.onselect === 'function') {
                    item.onselect();
                }
            };
            document.getElementById(toolbarID || 'toolbar').appendChild(menu);

            if (!defaultAction && typeof options[0].onselect === 'function') {
                defaultAction = options[0].onselect;
            }

            for (var i = 0, len = options.length; i < len; ++i) {
                var option = document.createElement('option');
                option.textContent = options[i].text;
                option.value = options[i].value;
                menu.appendChild(option);
            }
        },
        reset: function () {
        }
    };


    var options = [
        {
            text: 'C',
            onselect: function () {
                createModel('C');
            }
        }, {
            text: 'prM',
            onselect: function () {
                createModel('prM');
            }
        }, {
            text: 'E',
            onselect: function () {
                createModel('E');
            }
        }, {
            text: 'NS5',
            onselect: function () {
                createModel('NS5');
            }
        }, {
            text: 'NS4B',
            onselect: function () {
                createModel('NS4B');
            }
        }
    ];

    PhyloGlobe.addToolbarMenu(options);

    /** general vars*/
    var viewer = new Cesium.Viewer('cesiumContainer', {
        imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
            url: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'
        })
    }
    );
    var pinBuilder = new Cesium.PinBuilder();
    var entities = viewer.entities;
    var minElevation = 100;
    var scaleFactor = 5000000;

    var countries = {};

    var strains = {};

    var ptree = entities.add(new Cesium.Entity());

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
            createModel('NS5');
        }
    });



    function createModel(name) {
         console.log('Loading data for protein '+name);
        entities.removeAll();
        loadMetaData(name);
    }

    function createModelFromInput(metadata, treedata) {
        entities.removeAll();
        processDatapoints(metadata);
        console.log('Loaded meta data');

        var tree = parseNewick(data);
        console.log(tree);
        console.log('Loaded tree data');
    }


    function loadMetaData(name) {
        $.ajax({
            type: 'GET',
            url: 'data/zika' + name + '.txt',
            dataType: 'text',
            success: function (data) {
                processDatapoints(data);
                console.log('Loaded meta data');
                loadTree(name);
            }
        });
    }

    function loadTree(name) {
        $.ajax({
            type: 'GET',
            url: 'data/zika' + name + '.nwk',
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
            if (c) {
                d.lat = c.lat;
                d.lon = c.lon;
            } else {
                console.log('Unable to determine location lat:lon for ' + d.Country + '. Will use 0:0');
                d.lat = 0;
                d.lon = 0;

            }
            strains[d.Accession] = d;
        });
//    console.log(datapoints);
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
                        node.xyz[1], node.xyz[0], node.xyz[2] + scaleFactor / 10]),
                    width: 3,
                    material: edgeColor
                }
            });
        }
    }


})();