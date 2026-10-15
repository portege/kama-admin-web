/**
 * pricing-schema.js — Backward-compatible wrappers
 *
 * These global functions delegate to the shared SchemaEditor instance created
 * by pricing.js.  They exist so that any existing onclick handlers still work.
 *
 * The real implementation lives in schema-editor.js (SchemaEditor class).
 */

/* global _pricingSchemaEditor:false */

function openSchemaEditor()       { window._pricingSchemaEditor?.open();  }
function closeSchemaEditor()      { window._pricingSchemaEditor?.close(); }
function openAddFieldModal()      { window._pricingSchemaEditor?.openAddField(); }
function openEditFieldModal(n)    { window._pricingSchemaEditor?.openEditField(n); }
function closeFieldModal()        { window._pricingSchemaEditor?.closeFieldModal(); }
function saveField()              { window._pricingSchemaEditor?.saveField(); }
function openRenameFieldModal(n)  { window._pricingSchemaEditor?.openRenameModal(n); }
function closeRenameFieldModal()  { window._pricingSchemaEditor?.closeRenameModal(); }
function saveRenameField()        { window._pricingSchemaEditor?.saveRename(); }
function removeField(n)           { window._pricingSchemaEditor?.removeField(n); }
function _seTriggerRebuild()      { window._pricingSchemaEditor?.triggerRebuild(); }
