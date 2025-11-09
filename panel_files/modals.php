<div id="modal-bg" class="hidden"></div>

<style>
/* Вкладки */
.tab-btn {
	@apply px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors;
}
.tab-btn.active {
	@apply text-white bg-gray-700 border-b-2 border-blue-500;
}
.tab-content {
	@apply hidden;
}
</style>

<script>
// Закрытие по ESC
document.addEventListener('keydown', e => {
	if (e.key === 'Escape') closeModal();
});
</script>