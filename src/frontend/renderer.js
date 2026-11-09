import { escapeHTML, sanitizeUrl } from '../utils/html.js';
import { normalizeSortOrder } from '../utils/sort.js';
import { readCategoryOrders, buildCategoryList } from '../utils/categories.js';
import { readSettings } from '../utils/settings.js';
import { isSubmissionEnabled } from '../admin/auth.js';
import frontendTemplate from '../templates/frontend.html';

// 访问前台时读取书签和分类，生成完整页面。
export async function handleFrontendRequest(request, env, ctx) {
  const url = new URL(request.url);
  const catalog = url.searchParams.get('catalog');

  let sites = [];
  try {
    const { results } = await env.NAV_DB.prepare('SELECT * FROM sites ORDER BY sort_order ASC, create_time DESC').all();
    sites = results;
  } catch (e) {
    console.error('加载书签失败', e);
    return new Response('加载书签失败，请稍后重试', { status: 500 });
  }

  const totalSites = sites.length;

  // 统计各分类下的书签数量及最小排序值
  const categoryMinSort = new Map();
  const categoryCountMap = new Map();
  const categorySet = new Set();
  sites.forEach((site) => {
    const name = (site.catelog || '').trim() || '未分类';
    categorySet.add(name);
    categoryCountMap.set(name, (categoryCountMap.get(name) || 0) + 1);
    const normalized = normalizeSortOrder(site.sort_order);
    if (!categoryMinSort.has(name) || normalized < categoryMinSort.get(name)) {
      categoryMinSort.set(name, normalized);
    }
  });

  let categoryOrderMap;
  try {
    categoryOrderMap = await readCategoryOrders(env);
  } catch (error) {
    console.error('加载分类失败', error);
    return new Response('加载分类失败，请稍后重试', { status: 500 });
  }

  const categoryRows = Array.from(categorySet, catelog => ({
    catelog,
    site_count: categoryCountMap.get(catelog),
    min_site_sort: categoryMinSort.get(catelog),
  }));
  const catalogs = buildCategoryList(categoryRows, categoryOrderMap).map(item => item.catelog);

  let settings;
  try {
    settings = await readSettings(env);
  } catch (error) {
    console.error('加载系统设置失败', error);
    settings = null;
  }

  const requestedCatalog = (catalog || '').trim();
  const catalogExists = Boolean(requestedCatalog && catalogs.includes(requestedCatalog));
  const currentCatalog = catalogExists ? requestedCatalog : catalogs[0];
  const currentSites = catalogExists
    ? sites.filter(s => ((s.catelog || '').trim() || '未分类') === currentCatalog)
    : sites;

  const catalogLinkMarkup = catalogs.map((cat) => {
    const safeCat = escapeHTML(cat);
    const encodedCat = encodeURIComponent(cat);
    const isActive = catalogExists && cat === currentCatalog;
    const count = categoryCountMap.get(cat) || 0;
    const linkClass = isActive
      ? 'nav-pill-active text-secondary-950 font-semibold dark:text-white'
      : 'text-secondary-600 hover:bg-white/50 hover:text-secondary-950 dark:text-secondary-300 dark:hover:bg-white/[0.08] dark:hover:text-white';
    const iconClass = isActive ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-400 group-hover:text-secondary-600 dark:text-secondary-500 dark:group-hover:text-secondary-300';
    const badgeClass = isActive
      ? 'bg-primary-500/15 text-primary-700 border-primary-500/25 dark:bg-primary-400/20 dark:text-primary-200 dark:border-primary-400/30'
      : 'bg-white/45 text-secondary-500 border-white/60 dark:bg-white/[0.06] dark:text-secondary-400 dark:border-white/10';
    return `<a href="?catalog=${encodedCat}" aria-label="查看${safeCat}分类" class="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-200 active:scale-[0.99] ${linkClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/40">
      <span class="flex min-w-0 items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2.5 shrink-0 transition-colors ${iconClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span class="truncate">${safeCat}</span>
      </span>
      <span class="ml-2 inline-flex h-5 min-w-[1.35rem] shrink-0 items-center justify-center rounded-md border px-1.5 text-[11px] font-medium tabular-nums ${badgeClass}">${count}</span>
    </a>`;
  }).join('');

  const datalistOptions = catalogs.map(cat => `<option value="${escapeHTML(cat)}">`).join('');
  const headingPlainText = catalogExists
    ? `${currentCatalog} · ${currentSites.length} 个网站`
    : `全部收藏 · ${sites.length} 个网站`;
  const headingText = escapeHTML(headingPlainText);
  const headingDefaultAttr = escapeHTML(headingPlainText);
  const headingActiveAttr = catalogExists ? escapeHTML(currentCatalog) : '';
  const submissionEnabled = isSubmissionEnabled(env);

  // 渲染站点卡片；没有数据时展示空状态，避免首页返回 404 文本。
  const siteCardsHtml = currentSites.length === 0 ? buildEmptySitesHtml() : currentSites.map((site) => {
    const rawName = site.name || '未命名';
    const rawDesc = site.desc || '暂无描述';
    const normalizedUrl = sanitizeUrl(site.url);
    const hrefValue = escapeHTML(normalizedUrl || '#');
    const displayUrlText = normalizedUrl || site.url || '';
    const safeDisplayUrl = displayUrlText ? escapeHTML(displayUrlText) : '未提供链接';
    const shortDomain = escapeHTML(extractDomain(displayUrlText));
    const dataUrlAttr = escapeHTML(normalizedUrl || '');
    const logoUrl = sanitizeUrl(site.logo);
    const cardInitial = escapeHTML((rawName.trim().charAt(0) || '站').toUpperCase());
    const avatarGradient = getAvatarGradient(rawName);
    const safeName = escapeHTML(rawName);
    const safeCatalog = escapeHTML(site.catelog || '未分类');
    const safeDesc = escapeHTML(rawDesc);
    const safeDataName = escapeHTML(site.name || '');
    const safeDataCatalog = escapeHTML(site.catelog || '');
    const hasValidUrl = Boolean(normalizedUrl);
    return `<div class="site-card group relative flex flex-col justify-between cursor-pointer overflow-hidden rounded-xl border border-white/65 p-4 backdrop-blur-2xl dark:border-white/[0.12]" data-id="${site.id}" data-name="${safeDataName}" data-url="${dataUrlAttr}" data-catalog="${safeDataCatalog}">
  <a href="${hrefValue}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} aria-label="访问${safeName}" class="block flex-1 rounded-lg focus:outline-none">
    <div class="flex min-w-0 items-start gap-3">
      <div class="favicon-shell relative flex shrink-0 items-center justify-center rounded-lg border border-white/75 bg-white/75 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_8px_rgba(15,23,42,0.05)] transition-transform duration-300 group-hover:scale-105 dark:border-white/15 dark:bg-white/[0.1] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
        ${logoUrl
          ? `<img src="${escapeHTML(logoUrl)}" alt="${safeName}" loading="lazy" class="h-full w-full rounded-md object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
             <div style="display:none" class="h-full w-full items-center justify-center rounded-md bg-gradient-to-br ${avatarGradient} text-xs font-bold text-white shadow-inner">${cardInitial}</div>`
          : `<div class="flex h-full w-full items-center justify-center rounded-md bg-gradient-to-br ${avatarGradient} text-xs font-bold text-white shadow-inner">${cardInitial}</div>`
        }
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-1.5">
          <h3 class="truncate text-[15px] font-bold leading-snug text-secondary-950 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-300" title="${safeName}">${safeName}</h3>
          <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-secondary-400 opacity-60 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-white/60 group-hover:text-primary-600 group-hover:opacity-100 dark:text-secondary-500 dark:group-hover:bg-white/10 dark:group-hover:text-primary-300" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M17 7H8M17 7V16" />
            </svg>
          </span>
        </div>
        <span class="mt-1 inline-flex h-5 max-w-full items-center gap-1 rounded-md border border-white/65 bg-white/50 px-2 text-[11px] font-medium text-secondary-600 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.08] dark:text-secondary-300">
          <span class="h-1.5 w-1.5 rounded-sm bg-primary-500/80 dark:bg-primary-400"></span>
          <span class="truncate">${safeCatalog}</span>
        </span>
      </div>
    </div>
    <p class="mt-3 min-h-[2.6rem] break-words text-xs leading-[1.45rem] text-secondary-600 line-clamp-2 dark:text-secondary-300/90" title="${safeDesc}">${safeDesc}</p>
  </a>
  <div class="mt-3.5 flex items-center justify-between gap-2 border-t border-white/45 pt-2.5 dark:border-white/[0.08]">
    <span class="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[11px] font-mono text-secondary-500 dark:text-secondary-400" title="${safeDisplayUrl}">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0 text-secondary-400 dark:text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      <span class="truncate">${shortDomain}</span>
    </span>
    <button class="copy-btn relative flex h-6 shrink-0 items-center rounded-md border px-2 transition-all duration-200 active:scale-95 ${hasValidUrl ? 'border-white/65 bg-white/55 text-secondary-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:border-white/90 hover:bg-white/85 hover:text-secondary-950 focus-visible:ring-primary-400/40 dark:border-white/12 dark:bg-white/[0.08] dark:text-secondary-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:hover:bg-white/20 dark:hover:text-white' : 'border-white/25 bg-white/20 text-secondary-400 cursor-not-allowed dark:border-white/5 dark:bg-white/5'} text-[11px] font-medium focus:outline-none focus-visible:ring-2" data-url="${dataUrlAttr}" aria-label="复制${safeName}的网址" ${hasValidUrl ? '' : 'disabled'}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
      </svg>复制
      <span class="copy-success absolute -top-8 right-0 hidden whitespace-nowrap rounded-md bg-secondary-950/90 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-md shadow-lg dark:bg-white/95 dark:text-secondary-950">已复制!</span>
    </button>
  </div>
</div>`;
  }).join('');

  const html = buildPageHtml({
    totalSites, catalogs, catalogExists, catalogLinkMarkup,
    datalistOptions, headingText, headingDefaultAttr, headingActiveAttr,
    submissionEnabled, siteCardsHtml, settings,
  });

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

/**
 * 从 URL 字符串提取精简域名用于卡片底部展示，在渲染每个站点卡片时调用
 */
function extractDomain(urlStr) {
  if (!urlStr) return '未提供链接';
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./i, '') || urlStr;
  } catch {
    return urlStr.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0] || urlStr;
  }
}

/**
 * 根据站点名称生成固定的柔和渐变色类名，用于无图标或图标加载失败时的首字母兜底头像
 */
function getAvatarGradient(name) {
  const palettes = [
    'from-indigo-500 to-sky-500',
    'from-violet-500 to-fuchsia-500',
    'from-rose-500 to-amber-500',
    'from-emerald-500 to-teal-500',
    'from-blue-600 to-cyan-500',
    'from-amber-500 to-orange-600',
  ];
  let hash = 0;
  const str = String(name || '站点');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return palettes[Math.abs(hash) % palettes.length];
}

// 当前分类没有书签时，生成空列表占位。
function buildEmptySitesHtml() {
  return `<div class="empty-sites-state col-span-full flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-white/65 px-6 py-8 text-center dark:border-white/12">
    <div class="mb-3.5 flex h-11 w-11 items-center justify-center rounded-lg border border-white/70 bg-gradient-to-br from-primary-500/15 to-sky-500/15 text-primary-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/15 dark:from-primary-400/20 dark:to-sky-400/20 dark:text-primary-300">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2h-2M5 11V9a2 2 0 012-2h2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2m-6 0h6" />
      </svg>
    </div>
    <h3 class="text-base font-bold text-secondary-950 dark:text-white">暂无书签</h3>
    <a href="/admin" class="btn-primary-pill mt-4 inline-flex items-center gap-1.5 rounded-lg bg-secondary-950 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-white dark:text-secondary-950 dark:hover:bg-secondary-100">
      <span>进入管理后台</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
    </a>
  </div>`;
}

// 前台数据准备完成后，填入模板并组合投稿入口。
function buildPageHtml({ totalSites, catalogs, catalogExists, catalogLinkMarkup, datalistOptions, headingText, headingDefaultAttr, headingActiveAttr, submissionEnabled, siteCardsHtml, settings }) {
  return renderTemplate(frontendTemplate, {
    ALL_LINK_CLASS: catalogExists
      ? 'text-secondary-600 hover:bg-white/50 hover:text-secondary-950 dark:text-secondary-300 dark:hover:bg-white/[0.08] dark:hover:text-white'
      : 'nav-pill-active text-secondary-950 font-semibold dark:text-white',
    ALL_ICON_CLASS: catalogExists ? 'text-secondary-400 dark:text-secondary-500' : 'text-primary-600 dark:text-primary-400',
    ALL_BADGE_CLASS: catalogExists
      ? 'bg-white/45 text-secondary-500 border-white/60 dark:bg-white/[0.06] dark:text-secondary-400 dark:border-white/10'
      : 'bg-primary-500/15 text-primary-700 border-primary-500/25 dark:bg-primary-400/20 dark:text-primary-200 dark:border-primary-400/30',
    CATALOG_LINKS: catalogLinkMarkup,
    SUBMISSION_ACTION: buildSubmissionActionHtml(submissionEnabled),
    FOOTER_LINKS: buildFooterLinksHtml(settings),
    GIT_LINK: buildGitLinkHtml(settings),
    TOTAL_SITES: String(totalSites),
    CATALOG_COUNT: String(catalogs.length),
    HEADING_DEFAULT_ATTR: headingDefaultAttr,
    HEADING_ACTIVE_ATTR: headingActiveAttr,
    HEADING_TEXT: headingText,
    SITE_CARDS: siteCardsHtml,
    CURRENT_YEAR: String(new Date().getFullYear()),
    ADD_SITE_MODAL: buildAddSiteModalHtml(submissionEnabled, datalistOptions),
  });
}

// 渲染顶部工具栏的代码仓库图标按钮，后台关闭时返回空字符串。
function buildGitLinkHtml(settings) {
  if (!settings || !settings.git_enabled || !settings.git_url) return '';
  const safeGitUrl = escapeHTML(sanitizeUrl(settings.git_url) || settings.git_url);
  return `<a href="${safeGitUrl}" target="_blank" rel="noopener noreferrer" aria-label="代码仓库" title="代码仓库" class="glass-panel flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg text-secondary-700 transition hover:bg-white/75 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:text-secondary-100 dark:hover:bg-white/15">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
          </a>`;
}

// 渲染侧边栏底部的快捷链接（博客入口与后台管理）。
function buildFooterLinksHtml(settings) {
  const showBlog = Boolean(settings && settings.blog_enabled && settings.blog_url);
  const adminMarkup = `<a href="/admin" target="_blank" class="flex items-center justify-center gap-1.5 rounded-lg border border-white/60 bg-white/45 px-3 py-2 text-xs font-medium text-secondary-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:bg-white/75 hover:text-secondary-950 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-400/40 dark:border-white/10 dark:bg-white/[0.06] dark:text-secondary-300 dark:hover:bg-white/[0.14] dark:hover:text-white">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    <span>后台管理</span>
  </a>`;

  if (!showBlog) {
    return `<div class="mt-2 grid grid-cols-1 gap-2">${adminMarkup}</div>`;
  }

  const safeBlogUrl = escapeHTML(sanitizeUrl(settings.blog_url) || settings.blog_url);
  const blogMarkup = `<a href="${safeBlogUrl}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center gap-1.5 rounded-lg border border-white/60 bg-white/45 px-3 py-2 text-xs font-medium text-secondary-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition hover:bg-white/75 hover:text-secondary-950 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-400/40 dark:border-white/10 dark:bg-white/[0.06] dark:text-secondary-300 dark:hover:bg-white/[0.14] dark:hover:text-white">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-primary-500 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H19v5.5M19 6l-8.5 8.5M8 7H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-2" /></svg>
    <span>我的博客</span>
  </a>`;

  return `<div class="mt-2 grid grid-cols-2 gap-2">${blogMarkup}${adminMarkup}</div>`;
}

// 渲染侧边栏时，根据投稿开关生成按钮或关闭提示。
function buildSubmissionActionHtml(submissionEnabled) {
  return submissionEnabled ? `<button id="addSiteBtnSidebar" class="btn-primary-pill flex w-full items-center justify-center rounded-lg bg-secondary-950 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-secondary-800 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-white dark:text-secondary-950 dark:hover:bg-secondary-100">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>添加新书签
        </button>` : `<div class="w-full rounded-lg border border-white/50 bg-white/40 px-3 py-2 text-center text-xs font-medium text-secondary-500 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] dark:text-secondary-400">访客书签提交已关闭</div>`;
}

// 允许访客投稿时，生成站点提交表单。
function buildAddSiteModalHtml(submissionEnabled, datalistOptions) {
  if (!submissionEnabled) return '';
  const inputCls = 'mt-1 block w-full rounded-lg border border-white/65 bg-white/60 px-3 py-2 text-sm text-secondary-950 placeholder-secondary-400 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-lg transition focus:border-primary-400 focus:bg-white/85 focus:outline-none focus:ring-2 focus:ring-primary-400/20 dark:border-white/14 dark:bg-white/[0.08] dark:text-white dark:placeholder-secondary-500 dark:focus:border-primary-400 dark:focus:bg-white/[0.12]';
  const labelCls = 'block text-xs font-semibold text-secondary-600 dark:text-secondary-300';
  return `<div id="addSiteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/45 opacity-0 invisible backdrop-blur-md transition-all duration-300">
    <div class="modal-card mx-4 w-full max-w-md translate-y-8 transform rounded-xl border border-white/70 transition-all duration-300 dark:border-white/15">
      <div class="p-5">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-white/50 dark:border-white/10">
          <div class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/15 text-primary-600 dark:bg-primary-400/20 dark:text-primary-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </div>
            <div>
              <h2 class="text-base font-bold text-secondary-950 dark:text-white">推荐新站点</h2>
            </div>
          </div>
          <button id="closeModal" aria-label="关闭弹窗" class="rounded-md p-1 text-secondary-400 transition hover:bg-white/60 hover:text-secondary-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-400/40 dark:hover:bg-white/10 dark:hover:text-white"><svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <form id="addSiteForm" class="space-y-3">
          <div><label for="addSiteName" class="${labelCls}">站点名称 *</label><input type="text" id="addSiteName" placeholder="例如：GitHub" required class="${inputCls}"></div>
          <div><label for="addSiteUrl" class="${labelCls}">站点网址 *</label><input type="text" id="addSiteUrl" placeholder="https://..." required class="${inputCls}"></div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label for="addSiteCatelog" class="${labelCls}">所属分类 *</label><input type="text" id="addSiteCatelog" placeholder="选择或输入分类" required class="${inputCls}" list="catalogList"><datalist id="catalogList">${datalistOptions}</datalist></div>
            <div><label for="addSiteLogo" class="${labelCls}">图标链接 (可选)</label><input type="text" id="addSiteLogo" placeholder="https://.../favicon.ico" class="${inputCls}"></div>
          </div>
          <div><label for="addSiteDesc" class="${labelCls}">站点简介 (可选)</label><textarea id="addSiteDesc" rows="2" placeholder="站点简介（可选）" class="${inputCls}"></textarea></div>
          <div class="flex justify-end gap-2 pt-3 border-t border-white/50 dark:border-white/10">
            <button type="button" id="cancelAddSite" class="rounded-lg border border-white/65 bg-white/55 px-3.5 py-1.5 text-xs font-semibold text-secondary-700 transition hover:bg-white/80 active:scale-95 focus:outline-none dark:border-white/12 dark:bg-white/10 dark:text-secondary-200 dark:hover:bg-white/20">取消</button>
            <button type="submit" class="btn-primary-pill inline-flex items-center justify-center rounded-lg bg-secondary-950 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-secondary-800 focus:outline-none dark:bg-white dark:text-secondary-950 dark:hover:bg-secondary-100">提交审核</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

// 组合页面时，替换模板中已知的占位符。
function renderTemplate(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });
}
