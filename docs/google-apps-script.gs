/**
 * 复制到 Google 表格：扩展程序 → Apps Script → 粘贴 → 部署为网页应用
 * 详见 docs/GOOGLE_SHEETS.md
 */
function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var values = sheet.getDataRange().getValues();
  var payload = JSON.stringify({ values: values });
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}
