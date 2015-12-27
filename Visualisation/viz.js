// Define global mode parameters
var inert = false;
var time_step;
var focus_label;
var focussed;
var thresh = 3;
var shiftDown = false;
var altDown = false;
var color = d3.scale.category20c();
var size_thresh = 1
var slideStop = new Event('slideStop')
var ds_filename = "datasetMon"

// loader settings
var opts = {
  lines: 10 // The number of lines to draw
, length: 0 // The length of each line
, width: 10 // The line thickness
, radius: 20 // The radius of the inner circle
, scale: 0.25 // Scales overall size of the spinner
, corners: 0.7 // Corner roundness (0..1)
, color: '#000' // #rgb or #rrggbb or array of colors
, opacity: 0.3 // Opacity of the lines
, rotate: 56 // The rotation offset
, direction: 1 // 1: clockwise, -1: counterclockwise
, speed: 2.2 // Rounds per second
, trail: 15 // Afterglow percentage
, fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
, zIndex: 2e9 // The z-index (defaults to 2000000000)
, className: 'spinner' // The CSS class to assign to the spinner
, top: '50%' // Top position relative to parent
, left: '50%' // Left position relative to parent
, shadow: false // Whether to render a shadow
, hwaccel: false // Whether to use hardware acceleration
, position: 'absolute' // Element positioning
}

// Load dataset and run main function inside
var main = function(ds_filename) {
  w1 = document.getElementById("w1");
  w2 = document.getElementById("w2");
  spinnerw1 = new Spinner(opts).spin(w1);
  spinnerw2 = new Spinner(opts).spin(w2);
  d3.json("data/" + ds_filename + ".json", function(ds_loaded) {
    spinnerw1.stop();
    spinnerw2.stop();
    visualizeit(ds_loaded)
  });
}

var visualizeit = function(ds_loaded) {

  window.dataset = ds_loaded

  // Draw window 1 
  polygons();
  
  // Global variables for graph
  graph = new myGraph("#svgdiv");
  var force, nodes, links;
  // Draw window 2
  dat = dataset['layer_networks']['data'][time_step]
  updateGraph(dat);
};

var slider = function() {
  
  $("#ex6").slider({
    formatter: function(value) {
      return 'Min. group size: ' + value;
    }
  });

  var sliderAction = function(evt) {
    // Update size_thresh
    old_size_thresh = size_thresh
    size_thresh = evt.value
    // Only act if diff betw new and old slider value is 1
    if (Math.abs(size_thresh-old_size_thresh) >= 1) {
      // --- Sausage view behavior --- //
      // Mimic 'out' behavior when slider is used
      if (inert==true) {
        out(focus_label)
        inert = false 
        console.log("inert", false)
        window.focus_label = undefined
        console.log("focus_label",focus_label)
        defaultColor()
      }
      
      // Loop through communitites and opaque out those below size_thresh
      communities = d3.keys(dataset['coms'])
      for (var c = 0; c < communities.length; c++) {
        com_label = communities[c]
        size = dataset['coms'][com_label]['max_size']
        if (size >= size_thresh) {
          d3.selectAll("."+com_label)
            .transition()
              .duration(200)
            .style({'opacity': 1.0})
        } else {
          d3.selectAll("."+com_label)
            .transition()
              .duration(200)
            .style({'opacity': 0.0})
        }
      }

      // --- Graph behavior --- //
      if (size_thresh-old_size_thresh > 0) {
        removeAllLinksBelowThresh();
        removeAllNodesBelowThresh();
      }
      else {
        dat = dataset['layer_networks']['data'][time_step]
        updateGraph(dat)
      }
    }
  }

  // Triggers action on slide event
  $("#ex6").on("slide", function(slideEvt) {
    sliderAction(slideEvt);  
  });

  $("#ex6").on("slideStop", function(stopEvt) {
    sliderAction(stopEvt);  
  });
}

var radioButtons = function() {
  $('#myButtonGroup .btn').on('click', function(e) {
    $('#myButtonGroup .active').removeClass('active');
    $(this).addClass('active');

    // Update data source
    ds_filename = e.toElement.id

    // Perform esc-key behavior
    out(focus_label)
    inert = false 
    console.log("inert", false)
    window.focus_label = undefined
    console.log("focus_label",focus_label)

    // Remove all svg
    d3.selectAll('svg').remove();

    // Build viz from scratch with new ds
    if (ds_filename != "") {
      main(ds_filename);
    }
  });
}


main(ds_filename);

// Draw window 3
slider();
radioButtons();



var polygons = function() {

  //=================//
  // Define canvases //
  //=================//

  var width_w1 = window.innerWidth*66/100;
  var height_w1 = window.innerHeight-10;
  var margin_w1 = {'left': 10, 'right': 40, 'top': 40, 'bottom': 20}

  var svg_w1 = d3.select("#w1")
    .append("svg:svg")
    .attr("width", width_w1)
    .attr("height", height_w1)

  //=========================//
  // Define tooltip behavior //
  //=========================//

  // Tooltip behavior for normal mode
  tip1 = d3.tip().attr('class', 'd3-tip')
    .offset([-10,0])
    .html(function(d) {
      c = d['c']
      abs_size = dataset['coms'][c]['abs_size']
      max_size = dataset['coms'][c]['max_size']
      min_size = dataset['coms'][c]['min_size']
      duration = dataset['coms'][c]['duration']
    return "<p class='text-muted'>"+focus_label.slice(1,focus_label.length)+"</p>"
      + "<p class='text-primary'>Members</p>"
      + "<p class='small'>Total : " + abs_size + "<br>"
      + "<p class='lead'>Minimum : " + min_size + "<br>"
      + "Maximum : " + max_size
      + "<p class='small'>Duration: " + Math.floor(duration/3600) +" h "+ Math.floor(duration%3600)/60 + " m </p>";
  });

  // Tooltip behavior for inert mode
  tip2 = d3.tip().attr('class', 'd3-tip')
    .attr('background', 'rgba(0,0,0,0.3')
    .offset([-12,0])
    .html(function(d) { 
      c = d['c']
      duration = dataset['coms'][c]['duration']
    return "<p class='text-muted'>"+d['c'].slice(1,d['c'].length)+"</p>"
      + "<p class='lead'>Similarity: "
      + Math.round( 1000*dataset['sims'][focus_label][d['c']]['sim']) / 10 + "%"
      + "<br>" + "In common: "
      + dataset['sims'][focus_label][d['c']]['count'] + "<p>"
      + "<p class='small'>Duration: " + Math.floor(duration/3600) +" h "+ Math.floor(duration%3600)/60 + " m </p>";
    });

  svg_w1.call(tip1)
  svg_w1.call(tip2)


  //=======================================//
  // Define hovering and clicking behavior //
  //=======================================//

  window.over = function(d) {
    size = dataset['coms'][focus_label]['max_size']
    if (size >= size_thresh) {
      d3.selectAll("."+focus_label)
        .transition()
        .duration(200)
        .style({'opacity': 0.8})
    

      for (var c = 0; c < communities.length; c++) {
        label_other = communities[c]
        sim = dataset['sims'][focus_label][label_other]['sim']
        size = dataset['coms'][label_other]['max_size']

        if (sim > 0 && size >= size_thresh) {
          d3.selectAll("."+label_other)
            .transition()
              .duration(200)
            .style({'opacity': sScale(sim)})
          d3.select("body").style("cursor", "pointer")
        } else {
          d3.selectAll("."+label_other)
            .transition()
              .duration(200)
            .style({'opacity': 0.0})
        }
      }

      if (inert==true) {
        tip1.show(d, document.getElementsByClassName(focus_label)[0])
        tip2.hide(d)
      }
    }
  }

  var overInert = function(d) {
    if (d['c'] != focus_label) {
      sim = dataset['sims'][focus_label][d['c']]['sim']
      size = dataset['coms'][d['c']]['max_size']
      if (sim > 0 && size >= size_thresh) {
        d3.select("body").style("cursor", "pointer")
        tip2.show(d, document.getElementsByClassName(d['c'])[0])
      }
    }
  }

  window.out = function(d) {
    communities = d3.keys(dataset['coms'])
    for (var c = 0; c < communities.length; c++) {
      com_label = communities[c]
      size = dataset['coms'][com_label]['max_size']
      if (size >= size_thresh) {
        d3.selectAll("."+com_label)
          .transition()
            .duration(200)
          .style({'opacity': 1.0})
      } else {
        d3.selectAll("."+com_label)
          .transition()
            .duration(200)
          .style({'opacity': 0.0})
      }
    }

    tip1.hide(d)
    tip2.hide(d)
  }

  var outInert = function(d) {
    if (d['c'] != focus_label) {
      tip2.hide(d)
    }
  }

  window.click = function(d) {
    size = dataset['coms'][focus_label]['max_size']
    if (size >= size_thresh) {
      inert = true;
      console.log("inert", true)
      console.log("focus_label", focus_label)
      tip1.show(d, document.getElementsByClassName(focus_label)[0])
    }
  }

  var clickInert = function(d) {
    size = dataset['coms'][focus_label]['max_size']
    if (d['c'] == focus_label && size >= size_thresh) {
      tip1.show(d, document.getElementsByClassName(focus_label)[0])
    }
  }


  // Set background click to exit inert mode
  svg_w1.selectAll("background")
      .data(["dummy"])
      .enter()
      .append("rect")
      .attr("class", "background")
      .attr('width', width_w1)
      .attr('height', height_w1)
      .attr('fill', 'white')
      .attr('fill-opacity', 1.0)
      .on("click", function(d) { 
          out(d)
          inert = false
          console.log("inert", false)
          window.focus_label = undefined
          console.log("focus_label", focus_label)
          defaultColor()  
      });




  //============================//
  // Draw on canvas (main code) //
  //============================//

  // Scaling
  var sd_width = dataset['meta']['w']
  var ds_height = dataset['meta']['h']

  window.xScale = d3.scale.linear()
          .domain([0, sd_width])
          .range([0, width_w1]);

  window.yScale = d3.scale.linear()
          .domain([0, ds_height])
          .range([0, height_w1]);

  window.xScaleC = d3.scale.linear()
          .domain([0, sd_width])
          .range([margin_w1['left'], width_w1-margin_w1['right']]);

  window.yScaleC = d3.scale.linear()
          .domain([0, ds_height])
          .range([margin_w1['top'], height_w1-margin_w1['bottom']]);

  window.sScale = d3.scale.sqrt()
          .domain([0, 1])
          .range([0.05, 0.8]);


  // Grid ticks
  var grid_ticks = dataset['time']['ticks']['grid_ticks']
  var grid_ticks_keys = d3.keys(grid_ticks)
  for (var i=0; i<grid_ticks_keys.length; i++) {
    key = grid_ticks_keys[i]
    svg_w1.append("line")
      .attr("x1", margin_w1['left']).attr("x2", width_w1-margin_w1['right'])
      .attr("y1", yScale(key)).attr("y2", yScale(key));
  }


  // Label ticks
  var label_ticks = dataset['time']['ticks']['label_ticks']
  var label_ticks_keys = d3.keys(label_ticks)
  svg_w1.selectAll("text")
      .data(label_ticks_keys)
      .enter()
      .append("text")
      .attr("y", function(d) { return yScale(d); })
      .attr("class", "tick")
      .attr("x", width_w1-margin_w1['right']+5)
      .text(function(d) { 
          var hour =  parseInt(label_ticks[d].slice(10,-6))
          if (hour == 0) { hour = 24 } if (hour <= 12) { period = " AM" } else { 
            hour -= 12; period = " PM"}
          if (hour + period == "9 AM") { time_step = parseInt(d) }
          return hour + period
      })
      .on('mouseover', function() {
          d3.select("body").style("cursor", "pointer")
      })
      .on('mouseout', function() {
          d3.select("body").style("cursor", "default")
      })
      .on('click', function(d) {
          time_step = d
          dat = dataset['layer_networks']['data'][time_step]
          d3.select(".time_step_box")
            .transition()
            .duration(function(d) {
              if (shiftDown == true) { return 2000; } 
              else { return 500; }
          })
            .attr("y", function(d) { return yScale(time_step-1) })
          updateGraph(dat)
          removeAllNodesBelowThresh();
      });

  // Time step band (init)
  svg_w1.selectAll("time_step_box")
      .data(["dummy"])
      .enter()
      .append("rect")
      .attr("class", "time_step_box")
      .attr("width", width_w1-margin_w1['left']-3)
      .attr("height", yScale(1))
      .attr("x", margin_w1['left'])
      .attr("y", yScale(time_step-1))
      .attr("fill", "teal")
      .attr("opacity", 0.25)


  // Loop over communities and draw them one at a time, adding hover and clicking behavior.
  communities = d3.keys(dataset['coms'])
  for (var i = 0; i < communities.length; i++) {

      label = communities[i];
      data = dataset['coms'][label]['blocks'];

      // Add polygons
      tmp = svg_w1.selectAll(label)
      .data(data)
      .enter()
      .append("polygon")
          .attr("points", function(d) { return d['points'].map( function(p) { return [xScaleC(p[0]), yScale(p[1])]; }); })
          .attr("class", label)
          .style({'fill': color(label)})
          .style({'stroke-width': 0.5})
          .style({'stroke': 'rgba(0,0,0,0.5'})
          .attr('opacity', function(d) {
              size = dataset['coms'][d['c']]['max_size']
              if (size >= size_thresh) {
                return 1.0;
              }
              else {
                return 0.0;
              }
          })
          .on('mouseup', function(d) {
              window.focus_label = d['c']
              console.log("focus_label", focus_label)
              if (inert==false) { click(d);} else
              if (inert==true) { clickInert(d) }
              over(d)
              focusColor()
          })
          .on('mouseover', function(d) { 
              if (inert==false) { window.focus_label = d['c']; over(d); focusColor() } 
              console.log("focus_label", focus_label)
              if (inert==true) { overInert(d) }
          })
          .on('mouseout', function(d) { 
              if (inert==false) { out(d); defaultColor(); }
              if (inert==true) { outInert(d) }
              d3.select("body").style("cursor", "default")
          })
     }
};


function myGraph() {
    //===============//
    // Define canvas //
    //===============//

    var width_w2 = window.innerWidth*1/3;
    var height_w2 = width_w2;
    var margin_w2 = {'left': 40, 'right': 10, 'top': 40, 'bottom': 20}
    var nominal_base_node_size = 7;
    var max_base_node_size = 36;

    var min_zoom = 0.1;
    var max_zoom = 7;
    var zoom = d3.behavior.zoom()
      .scaleExtent([min_zoom,max_zoom])
    var size = d3.scale.pow().exponent(1)
      .domain([1,100])
      .range([8,24]);

    window.zoom = zoom

    var svg_w2 = d3.select("#w2")
            .append("svg:svg")
            .attr("width", width_w2)
            .attr("height", height_w2);

    var g = svg_w2.append("g")


    //=====================================//
    // Functions to add/remove links/nodes //
    //=====================================//

    this.addNode = function (id) {

        group = dataset['layer_networks']['data'][time_step]['nodes'][id]['group']
        grp_size = dataset['coms']["c"+group]['max_size']

        if (grp_size >= size_thresh) {
            // Initiate randomly
            if (keep_nodes.length == 0) {
                nodes.push({"id": id});
            } else {
                // Get all linked nodes that stayed in graph across time steps
                linked_nodes = dataset['layer_networks']['data'][time_step]['links_dict'][id]
                  .filter(function(n) { return keep_nodes.indexOf(String(n)) != -1; })

                if (linked_nodes.length > 0) {
                    linked_nodes_objects = nodes.filter(function(i) {return linked_nodes.indexOf(parseInt(i.id)) != -1;});
                    x_vals = linked_nodes_objects.map(function(n) {return n.x});
                    y_vals = linked_nodes_objects.map(function(n) {return n.y});
                    x_init = d3.mean(x_vals);
                    y_init = d3.mean(y_vals);

                    nodes.push({"id": id,
                            "x": x_init,
                            "y": y_init});

                } else {

                    //group = dataset['layer_networks']['data'][time_step]['nodes'][id]['group']
                    grp_nodes = dataset['layer_networks']['data'][time_step]['groups'][group]
                      .filter(function(n) { return keep_nodes.indexOf(String(n)) != -1; })

                    if (grp_nodes.length > 0) {
                        grp_nodes_objects = nodes.filter(function(i) {return grp_nodes.indexOf(parseInt(i.id)) != -1;})
                        x_init = d3.mean(grp_nodes_objects.map(function(n) {return n.x}))
                        y_init = d3.mean(grp_nodes_objects.map(function(n) {return n.y}))
                    } else {
                        x_init = width_w2 * (Math.random()*1/2 + 1/4)
                        y_init = height_w2 * (Math.random()*1/2 + 1/4)
                    }
                    nodes.push({"id": id,
                                "x": x_init,
                                "y": y_init});

                }
            }
        }

    };

    this.removeNode = function (id) {
        var i = 0;
        var n = findNode(id);
        while (i < links.length) {
            if ((links[i]['source'] == n) || (links[i]['target'] == n)) {
                links.splice(i, 1);
            }
            else i++;
        }
        nodes.splice(findNodeIndex(id), 1);
    };

    this.addLink = function (source, target, value) {
        source_group = dataset['layer_networks']['data'][time_step]['nodes'][source]['group']
        target_group = dataset['layer_networks']['data'][time_step]['nodes'][target]['group']
        source_grp_size = dataset['coms']["c"+source_group]['max_size']
        target_grp_size = dataset['coms']["c"+target_group]['max_size']

        if (source_grp_size >= size_thresh && target_grp_size >= size_thresh) {
          link = {"source": findNode(source), "target": findNode(target), "value": value}
          links.push(link);
        }
        
    };

    this.removeLink = function (source, target) {
        for (var i = 0; i < links.length; i++) {
            if (links[i].source.id == source && links[i].target.id == target) {
                links.splice(i, 1);
                break;
            }
        }
    };

    this.removeAllLinks = function () {
        links.splice(0, links.length);
        update();
    };

    this.removeAllNodes = function () {
        nodes.splice(0, links.length);
        update();
    };

    window.removeAllLinksBelowThresh = function () {
        i = 0;
        while (i < links.length) {
            source = links[i].source.id
            target = links[i].target.id
            source_group = dataset['layer_networks']['data'][time_step]['nodes'][source]['group']
            target_group = dataset['layer_networks']['data'][time_step]['nodes'][target]['group']
            source_grp_size = dataset['coms']["c"+source_group]['max_size']
            target_grp_size = dataset['coms']["c"+target_group]['max_size']

            if (source_grp_size < size_thresh || target_grp_size < size_thresh) {
                links.splice(i, 1);
            }
            else i++;
        }
        
        update();
    };

    window.removeAllNodesBelowThresh = function () {
        i = 0
        while (i < nodes.length) {
            node = nodes[i].id
            group = dataset['layer_networks']['data'][time_step]['nodes'][node]['group']
            grp_size = dataset['coms']["c"+group]['max_size']

            if (grp_size < size_thresh) {
                nodes.splice(i, 1);
            }
            else i++;
        }
        
        update();
    };


    var findNode = function (id) {
        for (var i in nodes) {
            if (nodes[i]["id"] == id) { return nodes[i]; }
        };
    };

    var findNodeIndex = function (id) {
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i]['id'] == id) { return i; }
        };
    };


    //===============//
    // Build network //
    //===============//

    force = d3.layout.force();

    nodes = force.nodes();
    links = force.links();

    force
        .gravity(.12)
        .linkStrength(0.2)
        .charge(-60)
        .linkDistance(15)
        .size([width_w2, height_w2])
        .start();

    window.update = function () {

        // Links
        var link = g.selectAll(".link")
                .data(links, function (d) {
                    return d.source.id + "-" + d.target.id;
                });

        link.enter().append("line")
                .attr("id", function (d) {
                    return d.source.id + "-" + d.target.id;
                })
                .attr("class", "link")
                .style("opacity", 0)
        link.append("title")
                .text(function (d) {
                    return d.value;
                });
        link.exit().remove();

        // Nodes
        var node = g.selectAll(".node")
                .data(nodes, function (d) {
                    return d.id;
                });


        var nodeEnter = node.enter().append("g")
                .attr("class", "node")
                .on('dblclick', function(d,i) {
                    thisnode = dataset['layer_networks']['data'][time_step]['nodes'][d.id]
                    window.focus_label = 'c'+thisnode['group']
                    data = dataset['coms'][focus_label]['blocks']
                    console.log("focus_label", focus_label)
                    focusColor()
                    over(data[0])
                    tip1.show(data[0], document.getElementsByClassName(focus_label)[0])
                    inert = true
                    console.log("inert", true)
                })
                .call(force.drag)
                .on('mousedown', function() { d3.event.stopPropagation() })
                .on('mouseover', function(d) {
                    if (inert==true) {
                        thisnode = dataset['layer_networks']['data'][time_step]['nodes'][d.id]
                        group = 'c'+thisnode['group']
                        if (group != focus_label) {
                            if (dataset['sims'][focus_label][group]['sim'] != 0) {
                                data = dataset['coms'][group]['blocks']
                                tip2.show(data[0], document.getElementsByClassName(group)[0])
                            }
                        }
                    }
                })
                .on('mouseout', function(d) {
                    tip2.hide()
                })

        var circle = nodeEnter.append("svg:circle")
                .attr("r", nominal_base_node_size)
                .attr("id", function (d) {
                    return "Node;" + d.id;
                })
                .attr("class", "nodeStrokeClass")
                .attr("fill", function(d, i) { 
                  thisnode = dataset['layer_networks']['data'][time_step]['nodes'][d.id]
                  if (inert==true) {
                      if ("c"+thisnode['group'] == focus_label) {
                          return color('c'+thisnode['group'])
                      } else {
                          full_col = color('c'+thisnode['group'])
                          this_col = d3.interpolateRgb(d3.rgb(full_col),d3.rgb(255,255,255))
                          return this_col(0.83)
                      }
                  } else {
                      return color('c'+thisnode['group'])
                  }
                })
                .attr('opacity', 0)
                .on('mouseover', function() { d3.select("body").style("cursor", "pointer") })
                .on('mouseout', function() { d3.select("body").style("cursor", "default") })



        zoom
          .on("zoom", function() {
            var base_radius = nominal_base_node_size;
              if (nominal_base_node_size*zoom.scale()>max_base_node_size) base_radius = max_base_node_size/zoom.scale();
                  circle.attr("d", d3.svg.symbol()
                  .size(function(d) { return Math.PI*Math.pow(size(d.size)*base_radius/nominal_base_node_size||base_radius,2); })
                  .type(function(d) { return d.type; }))
              

            g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
          });
         
        svg_w2.call(zoom).on("dblclick.zoom", null); 

        nodeEnter.append("svg:text")
                .attr("class", "textClass")
                .attr("x", 14)
                .attr("y", ".31em")
                .text(function (d) {
                    return d.id;
                })
                .attr("opacity", function() {
                    if (altDown == true) {
                        return 0.5
                    } else {
                        return 0
                    }
                });

        node.exit().remove();

        counter = 0
        force.on("tick", function () {
            counter++

            if (counter <= thresh) {
                force
                     .friction(0.9*counter/thresh)
                     .alpha(0.5)
                     .gravity(0.1*counter/thresh)
                     .charge(-60*counter/thresh-40)
            }

            node.attr("transform", function (d, i) {
                return "translate(" + 
                                  d.x + "," + 
                                  d.y + ")";
            });

            link.attr("x1", function (d) {
                    return d.source.x;
                })
                .attr("y1", function (d) {
                    return d.source.y;
                })
                .attr("x2", function (d) {
                    return d.target.x;
                })
                .attr("y2", function (d) {
                    return d.target.y;
                });
        });

        // Restart the force layout.
        force.start();
    };

    window.update = update

    // Make it all go
    update();
}


var focusColor = function () {
    size = dataset['coms'][focus_label]['max_size']
    if (size >= size_thresh) {
      d3.selectAll("circle")
        .transition()
        .duration(200)
        .attr("fill", function(d, i) {
            thisnode = dataset['layer_networks']['data'][time_step]['nodes'][d.id]
            if ("c"+thisnode['group'] == focus_label) {
                return color('c'+thisnode['group'])
            } else {
                full_col = color('c'+thisnode['group'])
                this_col = d3.interpolateRgb(d3.rgb(full_col),d3.rgb(255,255,255))
                return this_col(0.83)

            }
        });

    d3.selectAll('.link')
        .transition()
        .duration(function(d) {
              if (shiftDown == true) { return 2000; } 
              else { return 200; }
          })
        .style("opacity", function(d) {
            sourcenode = dataset['layer_networks']['data'][time_step]['nodes'][d.source.id]
            targetnode = dataset['layer_networks']['data'][time_step]['nodes'][d.target.id]
                if ("c"+sourcenode['group'] == focus_label && "c"+targetnode['group'] == focus_label) {
                    return 0.8
                } else {
                    return 0.1
                }
        })
    }
};


var defaultColor = function () {
    d3.selectAll("circle")
        .transition()
        .duration(function() {
              if (shiftDown == true) { return 2000; } 
              else { return 200; }
          })
        .attr("fill", function(d, i) {
            thisnode = dataset['layer_networks']['data'][time_step]['nodes'][d.id]
            if (inert==true) {
                if ("c"+thisnode['group'] == focus_label) {
                    return color('c'+thisnode['group'])
                } else {
                    full_col = color('c'+thisnode['group'])
                    this_col = d3.interpolateRgb(d3.rgb(full_col),d3.rgb(255,255,255))
                    return this_col(0.83)
                }
            } else {
                return color('c'+thisnode['group'])
            }
        })
        .attr("opacity", 1)

    d3.selectAll('.link')
        .transition()
        .duration(function(d) {
              if (shiftDown == true) { return 2000; } 
              else { return 200; }
          })
        .style("opacity", function(d) {
            sourcenode = dataset['layer_networks']['data'][time_step]['nodes'][d.source.id]
            targetnode = dataset['layer_networks']['data'][time_step]['nodes'][d.target.id]
            if (inert==true) {
                if ("c"+sourcenode['group'] == focus_label && "c"+targetnode['group'] == focus_label) {
                    return 0.8
                } else {
                    return 0.1
                }
            } else {
                return 0.8
            }
        })
};


function updateGraph(dat) {

    // Get nodes and links
    new_nodes = d3.keys(dat['nodes'])//.map(function(d) { return d['name']; })
    current_nodes = nodes.map(function(d) { return d['id']; })
    new_links = dat['links']
    current_links = links.map(function(d) { 
        return {'source': d['source']['id'],
                'target': d['target']['id'],
                'value': d['value']};
    })

    console.log("current_nodes.length", current_nodes.length)
    console.log("new_nodes.length", new_nodes.length)

    // Calculate node and link edits
    remove_nodes = diff(current_nodes, new_nodes)
    add_nodes = diff(new_nodes, current_nodes)
    keep_nodes = intersec(new_nodes, current_nodes)

    remove_links = diff(current_links.map(function(d) { return JSON.stringify(d); }),
                            new_links.map(function(d) { return JSON.stringify(d); }))
                                     .map(function(d) { return JSON.parse(d); })
    add_links = diff(new_links.map(function(d) { return JSON.stringify(d); }),
                 current_links.map(function(d) { return JSON.stringify(d); }))
                              .map(function(d) { return JSON.parse(d); })


    if (new_nodes.length != current_nodes.length - remove_nodes.length + add_nodes.length) {
        console.log("Unbalanced change in nodes. Something is not right")
    }
    if (new_links.length != current_links.length - remove_links.length + add_links.length) {
        console.log("Unbalanced change in nodes. Something is not right")
    }

    // Remove and add nodes
    for (var i in remove_links) {
        if (i == "diff") continue;
        graph.removeLink(remove_links[i]['source'],
                         remove_links[i]['target'])
    }
    for (var i in remove_nodes) {
        if (i == "diff") continue;
        graph.removeNode(remove_nodes[i])
    }
    for (var i in add_nodes) {
        if (i == "diff") continue;
        graph.addNode(add_nodes[i])
    }
    for (var i in add_links) { 
        if (i == "diff") continue;
        graph.addLink(add_links[i]['source'],
                      add_links[i]['target'],
                      add_links[i]['value'])
    }
    update();
    defaultColor()
    keepNodesOnTop();

    for (var i in new_nodes) {
        group = 'c'+dataset['layer_networks']['data'][time_step]['nodes'][new_nodes[i]]['group']
        if (group == focus_label) {
        }
    }

    // callback for the changes in the network
    var step = -1;
    function nextval()
    {
        step++;
        return 2000 + (1500*step); // initial time, wait time
    }
}

// Set esc-key to exit inert mode
$(document).keyup(function(e) {
  if (e.keyCode == 27) {
    out(focus_label)
    inert = false 
    console.log("inert", false)
    window.focus_label = undefined
    console.log("focus_label",focus_label)
    defaultColor()
  }
});

var nextStep = function() {
    time_step++
    dat = dataset['layer_networks']['data'][time_step]
    d3.select(".time_step_box")
        .transition()
        .duration(function() {
            if (shiftDown == true) {
                return 2000;
            } else {
                return 200;
            }
        })
        .attr("y", function(d) { return yScale(time_step-1) })
    console.log("time_step", time_step)
    updateGraph(dat)
    removeAllNodesBelowThresh();
}

var prevStep = function() {
    time_step--
    dat = dataset['layer_networks']['data'][time_step]
    d3.select(".time_step_box")
        .transition()
        .duration(function() {
            if (shiftDown == true) {
                return 2000;
            } else {
                return 200;
            }
        })
        .attr("y", function(d) { return yScale(time_step-1) })
    console.log("time_step", time_step)
    updateGraph(dat)
    removeAllNodesBelowThresh();
}

// Set graph to change on arrow-keys
$(document).keydown(function(e) {
  if (shiftDown == true) {
    thresh = 100;
  } else {
    thresh = 3;
  }
  if (e.keyCode == 38) { // Up
    prevStep()
  }
});

$(document).keydown(function(e) {
  if (shiftDown == true) {
    thresh = 150;
  } else {
    thresh = 20;
  }
  if (e.keyCode == 40) { // Down
    nextStep()
  }
});

$(document).keydown(function(e) {
    if (e.keyCode == 16) {
        shiftDown = true;
    }
}).keyup(function(e) {
    if (e.keyCode == 16) {
        shiftDown = false;
    }
});

$(document).keydown(function(e) {
    if (e.keyCode == 18) {
        altDown = true;
        d3.selectAll("text")
          .transition()
          .duration(100)
          .attr("opacity", 0.5)
    }
}).keyup(function(e) {
    if (e.keyCode == 18) {
        altDown = false;
        d3.selectAll("text")
          .transition()
          .duration(100)
          .attr("opacity", 0)
    }
});



var ar = new Array(33,34,35,36,37,38,39,40);

$(document).keydown(function(e) {
     var key = e.which;
      if($.inArray(key,ar) > -1) {
          e.preventDefault();
          return false;
      }
      return true;
});


var union = function(arr1, arr2) {
    var r = arr1.slice(0);
    arr2.forEach(function(i) { if (r.indexOf(i) < 0) r.push(i); });
    return r;
};

var intersec = function(arr1, arr2) {
    return arr1.filter(function(i) {return arr2.indexOf(i) != -1;}); 
}

var diff = function(arr1, arr2) {
    return arr1.filter(function(i) {return arr2.indexOf(i) < 0;});
}



// because of the way the network is created, nodes are created first, and links second,
// so the lines were on top of the nodes, this just reorders the DOM to put the svg:g on top
function keepNodesOnTop() {
    $(".nodeStrokeClass").each(function( index ) {
        var gnode = this.parentNode;
        gnode.parentNode.appendChild(gnode);
    });
}
