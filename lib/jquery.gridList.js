;(function($, window, document, undefined) {

  var DraggableGridList = function(element, options) {
    this.options = $.extend({}, this.defaults, options);
    this.$element = $(element);
    this.init();
  };

  DraggableGridList.prototype.defaults = {
    DOMDataKey: '_gridList',
    rows: 5,
    itemWidth: 100,
    itemHeight: 100
  };

  DraggableGridList.prototype.init = function() {
    // Unbind any previous instance of DraggableGridList found on the targeted
    // element, and add a reference to the new one
    var previousInstance = this.$element.data(this.options.DOMDataKey);
    if (previousInstance instanceof DraggableGridList) {
      previousInstance.unbindDragEvents();
    }
    this.$element.data(this.options.DOMDataKey, this);

    // Read items and their meta data
    this.$items = this.$element.children('li');
    this.items = this._generateItemsFromDOM();

    // Create a deep copy of the items; we use them to revert the item
    // positions after each drag change, making an entire drag operation less
    // distructable
    this._items = [];
    this._copyItems(this.items, this._items);

    // Create instance of GridList (decoupled lib for handling the grid
    // positioning and sorting post-drag and dropping)
    this.gridList = new GridList(this.items, {rows: this.options.rows});

    // Render the list for the first time
    this._applySizeToItems();
    this._applyPositionToItems();

    // Init Draggable JQuery UI plugin for each of the list items
    // http://api.jqueryui.com/draggable/
    this.$items.draggable({
      zIndex: this.items.length
    });
    this.bindDragEvents();

    // Used to highlight a position an element will land on upon drop
    this.$positionHighlight = $('<li class="position-highlight"></li>').hide();
    this.$element.append(this.$positionHighlight);
  };

  DraggableGridList.prototype.bindDragEvents = function() {
    this._onDrag = this._bindMethod(this.onDrag);
    this._onStop = this._bindMethod(this.onStop);
    this.$items.on('drag', this._onDrag);
    this.$items.on('dragstop', this._onStop);
  };

  DraggableGridList.prototype.unbindDragEvents = function() {
    this.$items.off('drag', this._onDrag);
    this.$items.off('dragstop', this._onStop);
  };

  DraggableGridList.prototype.onDrag = function(event, ui) {
    var item = this._getItemByElement(ui.helper),
        newPosition = this._snapItemPositionToGrid(item);

    if (this._dragPositionChanged(newPosition)) {
      this._previousDragPosition = newPosition;

      // Regenerate the grid with the positions from when the drag started
      this._copyItems(this._items, this.items);
      this.gridList.createGrid();

      // Since the items list is a deep copy, we need to fetch the item
      // corresponding to this drag action again
      item = this._getItemByElement(ui.helper);
      this.gridList.moveItemToPosition(item, newPosition);

      // Visually update item positions and highlight shape
      this._applyPositionToItems();
      this._highlightPositionForItem(item);
    }
  };

  DraggableGridList.prototype.onStop = function(event, ui) {
    // Use the current items as the next starting point for a new drag action
    this._copyItems(this.items, this._items);
    this._previousDragPosition = null;

    this._applyPositionToItems();
    this._removePositionHighlight();
  };

  DraggableGridList.prototype._bindMethod = function(fn) {
    /**
     * Bind prototype method to instance scope (similar to CoffeeScript's fat
     * arrow)
     */
    var that = this;
    return function() {
      return fn.apply(that, arguments);
    };
  };

  DraggableGridList.prototype._generateItemsFromDOM = function() {
    /**
     * Generate the structure of items used by the GridList lib, using the DOM
     * data of the children of the targeted element. The items will have an
     * additional reference to the initial DOM element attached, in order to
     * trace back to it and re-render it once its properties are changed by the
     * GridList lib
     */
    var _this = this,
        items = [],
        item;
    this.$items.each(function(i, element) {
      item = {
        $element: $(element)
      };
      $.extend(item, $(element).data());
      if (!item.h) {
        item.h = _this.options.rows;
        this.autoHeight = true;
      }
      items.push(item);
    });
    return items;
  };

  DraggableGridList.prototype._getItemByElement = function(element) {
    // XXX: this could be optimized by storing the item reference inside the
    // meta data of the DOM element
    for (var i = 0; i < this.items.length; i++) {
      if (this.items[i].$element.is(element)) {
        return this.items[i];
      }
    }
  };

  DraggableGridList.prototype._snapItemPositionToGrid = function(item) {
    // TODO: Account for spaces and separators between groups
    var position = item.$element.position(),
        col = Math.round(position.left / this.options.itemWidth),
        row = Math.round(position.top / this.options.itemHeight);
    // Keep item position within the grid
    // TODO: Don't let the item create more than one extra column
    col = Math.max(col, 0);
    row = Math.max(row, 0);
    // Item might have 100% height
    row = Math.min(row, this.options.rows - (item.h || this.options.rows));
    return [col, row];
  };

  DraggableGridList.prototype._dragPositionChanged = function(newPosition) {
    if (!this._previousDragPosition) {
      return true;
    }
    return (newPosition[0] != this._previousDragPosition[0] ||
            newPosition[1] != this._previousDragPosition[1]);
  };

  DraggableGridList.prototype._highlightPositionForItem = function(item) {
    this.$positionHighlight.css({
      width: this._getItemWidth(item),
      height: this._getItemHeight(item),
      left: item.x * this.options.itemWidth,
      top: item.y * this.options.itemHeight
    }).show();
  };

  DraggableGridList.prototype._removePositionHighlight = function() {
    this.$positionHighlight.hide();
  };

  DraggableGridList.prototype._applySizeToItems = function() {
    for (var i = 0; i < this.items.length; i++) {
      this.items[i].$element.css({
        width: this._getItemWidth(this.items[i]),
        height: this._getItemHeight(this.items[i])
      });
    }
  };

  DraggableGridList.prototype._applyPositionToItems = function() {
    // TODO: Implement group separators
    for (var i = 0; i < this.items.length; i++) {
      // Don't interfere with the positions of the dragged items
      if (this.items[i].move) {
        continue;
      }
      this.items[i].$element.css({
        left: this.items[i].x * this.options.itemWidth,
        top: this.items[i].y * this.options.itemHeight
      });
    }
  };

  DraggableGridList.prototype._getItemWidth = function(item) {
    return item.w * this.options.itemWidth;
  };

  DraggableGridList.prototype._getItemHeight = function(item) {
    return item.h * this.options.itemHeight;
  };

  DraggableGridList.prototype._copyItems = function(from, to) {
    /**
     * We use the same two arrays to not constantly create new objects with
     * leaking potential. We assume the same number of items in both!
     */
    for (var i = 0; i < from.length; i++) {
      to[i] = $.extend({}, from[i]);
    }
  };

  $.fn.gridList = function(options) {
    if (!window.GridList) {
      throw new Error('GridList lib required');
    }
    this.each(function() {
      new DraggableGridList(this, options);
    });
    // Maintain jQuery chain
    return this;
  };

})(jQuery, window, document);