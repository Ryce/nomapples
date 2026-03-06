<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const navItems = [
		{ href: '/', label: 'Compare' },
		{ href: '/products', label: 'Products' },
		{ href: '/countries', label: 'Countries' },
		{ href: '/methodology', label: 'Methodology' }
	];
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
		<nav>
			{#each navItems as item}
				<a href={item.href} class:active={page.url.pathname === item.href}>{item.label}</a>
			{/each}
		</nav>
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

	nav {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
	}

	nav a {
		padding: 0.42rem 0.65rem;
		border-radius: 999px;
		text-decoration: none;
		font-size: 0.83rem;
		color: #4b5563;
		white-space: nowrap;
	}

	nav a.active {
		background: #111827;
		color: #fff;
	}
</style>
