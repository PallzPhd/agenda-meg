/* jshint esversion:11 */

document.getElementById('btn-prev').addEventListener('click', prevWeek);
document.getElementById('btn-next').addEventListener('click', nextWeek);
document.getElementById('btn-today').addEventListener('click', goToday);

setInterval(function() {
  if (currentWeekStart) { renderWeek(currentWeekStart, allEvents); }
}, 30000);
