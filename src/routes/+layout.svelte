<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<header>
		<a class="brand" href="/">
			<span class="dot"></span>
			nomapples
		</a>
		<a class="method" href="/methodology">Method</a>
	</header>

	{@render children()}
</div>

<style>
	.shell {
		min-height: 100vh;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 1rem;
		background: rgba(243, 245, 248, 0.92);
		backdrop-filter: blur(6px);
		border-bottom: 1px solid #e5e7eb;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 800;
		text-decoration: none;
		color: #111827;
	}

	.dot {
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: #111827;
	}

	.method {
		text-decoration: none;
		color: #4b5563;
		font-weight: 600;
		font-size: 0.88rem;
	}
</style>
