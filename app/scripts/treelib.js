// striped down version of
//https://github.com/rdmpage/treelib-js


/**
 *
 * Javascript library to display phylogenetic trees
 *
 */

//--------------------------------------------------------------------------------------------------
// http://stackoverflow.com/questions/3019278/any-way-to-specify-the-base-of-math-log-in-javascript
function log10(val) {
    return Math.log(val) / Math.LN10;
}

// http://stackoverflow.com/questions/387707/whats-the-best-way-to-define-a-class-in-javascript

//--------------------------------------------------------------------------------------------------
// http://stackoverflow.com/questions/1303646/check-whether-variable-is-number-or-string-in-javascript
function isNumber(o) {
    return !isNaN(o - 0);
}

//--------------------------------------------------------------------------------------------------
function ctype_alnum(str)
{
    return (str.match(/^[a-z0-9]+$/i) != null);
}

//--------------------------------------------------------------------------------------------------
function linePath(p0, p1)
{
    var path = 'M ' + p0['x'] + ' ' + p0['y'] + ' ' + p1['x'] + ' ' + p1['y'];
    return path;
}

//--------------------------------------------------------------------------------------------------
// Remove NEXUS-style string formatting, e.g. underscores
function formatString(s)
{
    s = s.replace(/_/g, ' ');
    return s;
}

//--------------------------------------------------------------------------------------------------
// http://stackoverflow.com/questions/894860/set-a-default-parameter-value-for-a-javascript-function
function Node(label)
{
    this.ancestor = null;
    this.child = null;
    this.sibling = null;
    this.label = typeof label !== 'undefined' ? label : '';
    this.id = 0;
    this.weight = 0;
    this.xy = [];
    this.edge_length = 0.0;
    this.path_length = 0.0;
    this.depth = 0;
}

//--------------------------------------------------------------------------------------------------
Node.prototype.IsLeaf = function ()
{
    return (!this.child);
}

//--------------------------------------------------------------------------------------------------
Node.prototype.GetRightMostSibling = function ()
{
    var p = this;
    while (p.sibling)
    {
        p = p.sibling;
    }
    return p;
};

//--------------------------------------------------------------------------------------------------
function Tree()
{
    this.root = null;
    this.num_leaves = 0;
    this.num_nodes = 0;
    this.label_to_node_map = [];
    this.nodes = [];
    this.rooted = true;
    this.has_edge_lengths = false;
    this.error = 0;
}

//--------------------------------------------------------------------------------------------------
Tree.prototype.NewNode = function (label)
{
    var node = new Node(label);
    node.id = this.num_nodes++;
    this.nodes[node.id] = node;

    if (typeof label !== undefined)
    {
        this.label_to_node_map[label] = node.id;
    }

    return node;
}

//--------------------------------------------------------------------------------------------------
Tree.prototype.Parse = function (str)
{
    str = str.replace('"', '');

    // Strip NEXUS-style comments
    str = str.replace(/\[[^\[]+\]/g, '');

    str = str.replace(/\(/g, '|(|');
    str = str.replace(/\)/g, '|)|');
    str = str.replace(/,/g, '|,|');
    str = str.replace(/:/g, '|:|');
    str = str.replace(/;/g, '|;|');
    str = str.replace(/\|\|/g, '|');
    str = str.replace(/^\|/, '');
    str = str.replace(/\|$/, '');

    //console.log(str);

    var token = str.split('|');

    var curnode = this.NewNode();
    this.root = curnode;

    var state = 0;
    var stack = [];
    var i = 0;
    var q = null;
    var label;

    this.error = 0;

    while ((state != 99) && (this.error == 0)) {
        switch (state) {
            case 0:
                if (ctype_alnum(token[i].charAt(0)))
                {
                    this.num_leaves++;
                    label = token[i];

                    // to do: KML

                    curnode.label = label;
                    this.label_to_node_map[label] = curnode;

                    i++;
                    state = 1;
                } else
                {
                    if (token[i].charAt(0) == '\'')
                    {
                        label = token[i];
                        label = label.replace(/^'/, '');
                        label = label.replace(/'$/, '');
                        this.num_leaves++;

                        // to do: KML


                        curnode.label = label;
                        this.label_to_node_map[label] = curnode;

                        i++;
                        state = 1;
                    } else
                    {
                        switch (token[i])
                        {
                            case '(':
                                state = 2;
                                break;

                            default:
                                state = 99;
                                this.error = 1; // syntax
                                break;
                        }
                    }
                }
                break;

            case 1: // getinternode
                switch (token[i])
                {
                    case ':':
                    case ',':
                    case ')':
                        state = 2;
                        break;
                    default:
                        state = 99;
                        this.error = 1; // syntax
                        break;
                }
                break;

            case 2: // nextmove
                switch (token[i])
                {
                    case ':':
                        i++;
                        if (isNumber(token[i]))
                        {
                            curnode.edge_length = parseFloat(token[i]);
                            this.has_edge_lengths = true;
                            i++;
                        }
                        break;

                    case ',':
                        q = this.NewNode();
                        curnode.sibling = q;
                        var c = stack.length;
                        if (c == 0)
                        {
                            state = 99;
                            this.error = 2; // missing (
                        } else
                        {
                            q.ancestor = stack[c - 1];
                            curnode = q;
                            state = 0;
                            i++;
                        }
                        break;

                    case '(':
                        stack.push(curnode);
                        q = this.NewNode();
                        curnode.child = q;
                        q.ancestor = curnode;
                        curnode = q;
                        state = 0;
                        i++;
                        break;

                    case ')':
                        if (stack.length == 0)
                        {
                            state = 99;
                            this.error = 3; // unbalanced
                        } else
                        {
                            curnode = stack.pop();
                            state = 3;
                            i++;
                        }
                        break;

                    case ';':
                        if (stack.length == 0)
                        {
                            state = 99;
                        } else
                        {
                            state = 99;
                            this.error = 4; // stack not empty
                        }
                        break;

                    default:
                        state = 99;
                        this.error = 1; // syntax
                        break;
                }
                break;

            case 3: // finishchildren
                if (ctype_alnum(token[i].charAt(0)))
                {
                    curnode.label = token[i];
                    this.label_to_node_map[token[i]] = curnode;
                    i++;
                } else
                {
                    switch (token[i])
                    {
                        case ':':
                            i++;
                            if (isNumber(token[i]))
                            {
                                curnode.edge_length = parseFloat(token[i]);
                                this.has_edge_lengths = true;
                                i++;
                            }
                            break;

                        case ')':
                            if (stack.length == 0)
                            {
                                state = 99;
                                this.error = 3; // unbalanced
                            } else
                            {
                                curnode = stack.pop();
                                i++;
                            }
                            break;

                        case ',':
                            q = this.NewNode();
                            curnode.sibling = q;

                            if (stack.length == 0)
                            {
                                state = 99;
                                this.error = 2; // missing (
                            } else
                            {
                                q.ancestor = stack[stack.length - 1];
                                curnode = q;
                                state = 0;
                                i++;
                            }
                            break;

                        case ';':
                            state = 2;
                            break;

                        default:
                            state = 99;
                            this.error = 1; // syntax
                            break;
                    }
                }
                break;
        }
    }
};

//--------------------------------------------------------------------------------------------------
Tree.prototype.ComputeWeights = function (p){
    if (p)
    {
        p.weight = 0;

        this.ComputeWeights(p.child);
        this.ComputeWeights(p.sibling);

        if (p.IsLeaf())
        {
            p.weight = 1;
        }
        if (p.ancestor)
        {
            p.ancestor.weight += p.weight;
        }
    }
};

//--------------------------------------------------------------------------------------------------
Tree.prototype.ComputeDepths = function (){
    for (var i in this.nodes)
    {
        if (this.nodes[i].IsLeaf())
        {
            var p = this.nodes[i].ancestor;
            var count = 1;
            while (p)
            {
                p.depth = Math.max(p.depth, count);
                count++;
                p = p.ancestor;
            }
        }
    }
};

//--------------------------------------------------------------------------------------------------
function NodeIterator(root){
    this.root = root;
    this.cur = null;
    this.stack = [];
}

//--------------------------------------------------------------------------------------------------
NodeIterator.prototype.Begin = function ()
{
    this.cur = this.root;
    while (this.cur.child)
    {
        this.stack.push(this.cur);
        this.cur = this.cur.child;
    }
    return this.cur;
}

//--------------------------------------------------------------------------------------------------
NodeIterator.prototype.Next = function ()
{
    if (this.stack.length == 0)
    {
        this.cur = null;
    } else
    {
        if (this.cur.sibling)
        {
            var p = this.cur.sibling;
            while (p.child)
            {
                this.stack.push(p);
                p = p.child;
            }
            this.cur = p;
        } else
        {
            this.cur = this.stack.pop();
        }
    }
    return this.cur;
}

//--------------------------------------------------------------------------------------------------
PreorderIterator.prototype = new NodeIterator;

function PreorderIterator()
{
    NodeIterator.apply(this, arguments)
}
;

//--------------------------------------------------------------------------------------------------
PreorderIterator.prototype.Begin = function ()
{
    this.cur = this.root;
    return this.cur;
}

//--------------------------------------------------------------------------------------------------
PreorderIterator.prototype.Next = function ()
{
    if (this.cur.child)
    {
        this.stack.push(this.cur);
        this.cur = this.cur.child;
    } else
    {
        while (this.stack.length > 0 && this.cur.sibling == null)
        {
            this.cur = this.stack.pop();
        }
        if (this.stack.length == 0)
        {
            this.cur = null;
        } else
        {
            this.cur = this.cur.sibling;
        }
    }
    return this.cur;
}


//--------------------------------------------------------------------------------------------------
function TreeDrawer()
{
    //this.t = tree;

    this.leaf_count = 0;
    this.leaf_gap = 0;
    this.node_gap = 0;
    this.last_y = 0;

    this.svg_id;

    this.draw_scale_bar = false;
}

//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.Init = function (tree, settings)
{
    this.t = tree;

    // defaults
    this.settings = settings;

    this.left = 0;
    this.top = 0;
};


//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.CalcInternal = function (p)
{
    var pt = [];
    pt['x'] = this.left + this.node_gap * (this.t.num_leaves - p.weight);
    pt['y'] = this.last_y - ((p.weight - 1) * this.leaf_gap) / 2;
    p.xy = pt;
}

//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.CalcLeaf = function (p)
{
    var pt = [];

    pt['y'] = this.top + (this.leaf_count * this.leaf_gap);
    this.last_y = pt['y'];
    this.leaf_count++;

    // slanted cladogram
    pt['x'] = this.left + this.settings.width;
    p.xy = pt;
}

//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.CalcNodeGap = function ()
{
    if (this.t.rooted)
    {
        this.node_gap = this.settings.width / this.t.num_leaves;
        this.left += this.node_gap;
        this.settings.width -= this.node_gap;
    } else
    {
        this.node_gap = this.settings.width / (this.t.num_leaves - 1);
    }
};

//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.CalcCoordinates = function ()
{
    this.t.ComputeWeights(this.t.root);

    this.leaf_count = 0;
    this.leaf_gap = this.settings.height / (this.t.num_leaves - 1);

    this.CalcNodeGap();

    var n = new NodeIterator(this.t.root);
    var q = n.Begin();
    while (q != null)
    {
        if (q.IsLeaf())
        {
            this.CalcLeaf(q);
        } else
        {
            this.CalcInternal(q);
        }
        q = n.Next();
    }
}

//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.DrawLeaf = function (p)
{
    var p0 = p.xy
    var anc = p.ancestor;
    if (anc)
    {
        var p1 = anc.xy;

        drawLine(this.settings.svg_id, p0, p1);
    }
}

//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.DrawInternal = function (p)
{
    var p0 = p.xy
    var anc = p.ancestor;
    if (anc)
    {
        var p1 = anc.xy;
        drawLine(this.settings.svg_id, p0, p1);
    }
}

//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.DrawRoot = function ()
{
    var p0 = this.t.root.xy
    var p1 = [];
    p1['x'] = p0['x'];
    p1['y'] = p0['y'];
    p1['x'] -= this.node_gap;

    drawLine(this.settings.svg_id, p0, p1);
}

//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.Draw = function ()
{
    var n = new NodeIterator(this.t.root);
    var q = n.Begin();
    while (q != null)
    {
        if (q.IsLeaf())
        {
            this.DrawLeaf(q);
        } else
        {
            this.DrawInternal(q);
        }
        q = n.Next();
    }
    if (this.t.rooted)
    {
        this.DrawRoot();
    }
}

//--------------------------------------------------------------------------------------------------
TreeDrawer.prototype.DrawLabels = function (nexus)
{
    var nxs = typeof nexus !== 'undefined' ? nexus : null;

    var n = new NodeIterator(this.t.root);
    var q = n.Begin();
    while (q != null)
    {
        if (q.IsLeaf())
        {
            var label = q.label;

            if (nxs)
            {
                if (nxs.treesblock.translate)
                {
                    if (nxs.treesblock.translate[label])
                    {
                        label = nxs.treesblock.translate[label];
                    }
                }
            }
            // offset
            label_xy = q.xy;
            label_xy['x'] += this.settings.fontHeight / 2.0;

            drawText('viewport', label_xy, formatString(label));
        }
        q = n.Next();
    }
}
