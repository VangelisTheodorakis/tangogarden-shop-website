(function () {
  'use strict';

  /* ===============================================================
     STRATEGY CHANGE: Stop replicating Shopify's close logic.
     Every version so far has guessed which classes/attributes to clear.
     Every time we got one wrong, state leaked.

     New approach: find the hamburger button, click it programmatically.
     Shopify's OWN code handles the close — in the right order, with
     the right classes, the right animations. We don't touch state at all.

     For same-page scrolls (the "invisible box" case), we do one extra
     thing AFTER Shopify closes: strip any leftover [open] on inner
     <details> elements. That's the only stale state that causes the
     invisible box, and it's safe to do because it's purely presentational
     at that point.
     ============================================================= */

  /* ================= 0. DEBUG UTILITY ================= */
  // Call window.debugMenuState() in the browser console to dump
  // everything relevant. Use this to see exactly what's in your DOM.
  window.debugMenuState = function () {
    const results = {};

    // The hamburger toggle button
    const hamburger = findHamburgerButton();
    results.hamburgerButton = hamburger ? {
      tagName: hamburger.tagName,
      id: hamburger.id,
      classes: hamburger.className,
      ariaExpanded: hamburger.getAttribute('aria-expanded'),
      ariaControls: hamburger.getAttribute('aria-controls')
    } : 'NOT FOUND';

    // The drawer element (whatever it is)
    const drawerCandidates = [
      'menu-drawer',
      'header-drawer',
      'x-drawer',
      '[id="' + (hamburger && hamburger.getAttribute('aria-controls') || '') + '"]'
    ];
    drawerCandidates.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        results['drawer: ' + sel] = {
          tagName: el.tagName,
          id: el.id,
          classes: el.className,
          open: el.hasAttribute('open'),
          ariaHidden: el.getAttribute('aria-hidden'),
          style: el.getAttribute('style')
        };
      }
    });

    // All <details> elements and their open state
    results.allDetails = Array.from(document.querySelectorAll('details')).map(d => ({
      id: d.id,
      classes: d.className,
      open: d.hasAttribute('open'),
      summaryText: d.querySelector('summary') ? d.querySelector('summary').textContent.trim().substring(0, 40) : ''
    }));

    // Classes on <html> and <body>
    results.htmlClasses = document.documentElement.className;
    results.bodyClasses = document.body.className;
    results.bodyStyle = document.body.getAttribute('style');

    // Any element with 'menu-open' or 'drawer' in its class
    results.menuOpenElements = Array.from(document.querySelectorAll('[class*="menu-open"], [class*="drawer"]')).map(el => ({
      tagName: el.tagName,
      id: el.id,
      classes: el.className
    }));

    console.table(results);
    console.log('Full dump:', JSON.stringify(results, null, 2));
    return results;
  };

  /* ================= 1. FIND THE HAMBURGER BUTTON ================= */
  // Craft/Dawn: the hamburger is a <button> with aria-controls pointing
  // to the drawer. We find it by aria-controls rather than by class,
  // because the class name varies between theme versions.
  function findHamburgerButton() {
    // Strategy 1: button whose aria-controls target contains 'menu' or 'drawer'
    const allButtons = document.querySelectorAll('button[aria-controls]');
    for (const btn of allButtons) {
      const targetId = btn.getAttribute('aria-controls');
      if (targetId && (targetId.toLowerCase().includes('menu') || targetId.toLowerCase().includes('drawer'))) {
        // Make sure it's actually in the header area
        if (btn.closest('header, .header, .header-wrapper, [class*="header"]')) {
          return btn;
        }
      }
    }

    // Strategy 2: common Craft/Dawn selectors as fallback
    return (
      document.querySelector('.header__icon--menu') ||
      document.querySelector('[data-menu-toggle]') ||
      document.querySelector('header button[aria-expanded]')
    );
  }

  /* ================= 2. CLOSE THE MENU ================= */
  function closeMobileMenu(hard, callback) {
    const hamburger = findHamburgerButton();

    // Only click if the menu is actually open
    const isOpen = hamburger && hamburger.getAttribute('aria-expanded') === 'true';

    if (isOpen && hamburger) {
      // Let Shopify close it its own way
      hamburger.click();

      // Wait for Shopify's close animation to finish (Dawn uses ~400ms)
      // then do the hard cleanup if needed
      setTimeout(() => {
        if (hard) {
          // Strip any leftover [open] on inner <details> — this is the
          // invisible box. Shopify's close only removes [open] on the
          // top-level details, not nested submenus.
          document.querySelectorAll('details[open]').forEach(details => {
            details.removeAttribute('open');
          });
          // Also reset any aria-expanded that might be left on summaries
          document.querySelectorAll('summary[aria-expanded="true"]').forEach(summary => {
            summary.setAttribute('aria-expanded', 'false');
          });
        }

        if (callback) callback();
      }, 450); // just over Dawn's 400ms closeAnimation

    } else {
      // Menu wasn't open (or button not found) — just run callback
      if (callback) setTimeout(callback, 50);
    }
  }

  /* ================= 3. DESKTOP HOVER LOGIC ================= */
  function initGardenNavigation() {
    if (window.innerWidth < 990) return;
    const menuItems = document.querySelectorAll('header-menu details, .header__inline-menu details');

    menuItems.forEach(details => {
      const summary = details.querySelector('summary');
      const submenu = details.querySelector('.header__submenu');
      if (!summary || !submenu) return;

      details.addEventListener('mouseenter', () => details.setAttribute('open', 'true'));
      details.addEventListener('mouseleave', () => {
        setTimeout(() => {
          if (!details.matches(':hover')) details.removeAttribute('open');
        }, 100);
      });

      summary.addEventListener('click', function (e) {
        const menuTitle = summary.querySelector('span').textContent.trim().toUpperCase();
        let targetUrl = '';
        if (menuTitle.includes('THE GARDEN')) targetUrl = '/pages/the-garden';
        else if (menuTitle.includes('START HERE')) targetUrl = '/pages/start-here';
        else if (menuTitle.includes('COMMUNITY')) targetUrl = '/pages/community';

        if (targetUrl) {
          e.preventDefault();
          window.location.href = targetUrl;
        }
      });
    });
  }

  /* ================= 4. MOBILE OVERVIEW INJECTION ================= */
  function injectMobileOverviewLinks() {
    if (window.innerWidth >= 990) return;

    const mapping = [
      { trigger: 'THE GARDEN', url: '/pages/the-garden' },
      { trigger: 'START HERE', url: '/pages/start-here' },
      { trigger: 'COMMUNITY', url: '/pages/community' }
    ];

    const mobileSubmenus = document.querySelectorAll('.menu-drawer__inner-submenu ul');

    mobileSubmenus.forEach(list => {
      if (list.querySelector('.injected-overview')) return;

      const details = list.closest('details');
      if (!details) return;

      const summaryText = details.querySelector('summary').textContent.trim().toUpperCase();
      const match = mapping.find(m => summaryText.includes(m.trigger));

      if (match) {
        const li = document.createElement('li');
        li.className = 'injected-overview';
        li.innerHTML = `
          <a href="${match.url}" class="menu-drawer__menu-item list-menu__item" style="color: #4E5D22; font-weight: 700; background: rgba(45, 80, 22, 0.04); border-bottom: 1px solid rgba(0, 0, 0, 0.05); padding: 2rem;">
            Overview
          </a>
        `;
        list.insertBefore(li, list.firstChild);
      }
    });
  }

  /* ================= 5. MOBILE CLICK INTERCEPTOR ================= */
  let mobileClickBound = false;

  function initMobileClickLogic() {
    if (window.innerWidth >= 990) return;
    if (mobileClickBound) return;
    mobileClickBound = true;

    document.addEventListener('click', (e) => {
      if (window.innerWidth >= 990) return;

      // Match links inside the menu drawer — cover all possible wrapper element names
      const link = e.target.closest('.menu-drawer a, menu-drawer a, header-drawer a, x-drawer a, [class*="drawer"] a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      e.preventDefault();
      e.stopPropagation();

      const url = new URL(link.href);
      const isSamePage = url.pathname === window.location.pathname;

      if (isSamePage && url.hash) {
        // Same-page scroll → hard close (cleans nested details), then scroll
        closeMobileMenu(true, () => {
          const target = document.querySelector(url.hash);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
            history.pushState(null, '', url.hash);
          }
        });
      } else {
        // Different page → let Shopify close, then navigate
        closeMobileMenu(false, () => {
          window.location.href = href;
        });
      }
    }, true);
  }

  /* ================= 6. INITIALIZATION ================= */
  function initAll() {
    initGardenNavigation();
    injectMobileOverviewLinks();
    initMobileClickLogic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  window.addEventListener('resize', initAll);
})();