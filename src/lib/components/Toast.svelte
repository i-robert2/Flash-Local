<script lang="ts">
  import type { Toast } from '../stores';

  let { toast }: { toast: Toast } = $props();
</script>

<div class="toast toast-{toast.type}" role="alert">
  {toast.message}
</div>

<style>
  .toast {
    padding: 0.75rem 1.25rem;
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: var(--shadow);
    animation: fadeIn 0.2s ease-out;
    white-space: nowrap;
  }
  .toast-success { background: var(--color-good); color: white; }
  .toast-error   { background: var(--color-danger); color: white; }
  .toast-info    { background: var(--color-primary); color: white; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(0.5rem); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
