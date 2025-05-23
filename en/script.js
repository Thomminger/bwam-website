// Wait for the DOM to be fully loaded before executing scripts
document.addEventListener('DOMContentLoaded', () => {

    // --- Configuration ---
    const DEFAULT_HOMEPAGE_SECTIONS = ['home', 'about-us', 'events', 'news']; // Sections visible on the main landing page
    const SCROLL_OFFSET_FOR_NAV = 80; // Adjust px offset below sticky header for scroll-to
    const CONSENT_STORAGE_KEY = window.CONSENT_STORAGE_KEY || 'bwam_consent_status'; // Use key defined in HTML

    // --- Cache DOM Elements ---
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const navLinks = document.querySelectorAll('.nav-section-link'); // Includes header, footer, and body links
    const mainSectionsNodeList = document.querySelectorAll('.main-section');
    const mainSections = Array.from(mainSectionsNodeList); // Convert to array for easier filtering
    const staticContentWrapper = document.getElementById('static-content-wrapper');
    const reactProfileSection = document.getElementById('react-profile-section');
    const consentBanner = document.getElementById('consent-banner');
    const consentAcceptButton = document.getElementById('consent-accept');
    const consentRejectButton = document.getElementById('consent-reject');
    const contactCtaButton = document.getElementById('contact-cta-button'); // Hero contact button
    const advisorModal = document.getElementById('advisor-modal');
    const modalOverlay = document.getElementById('modal-overlay');
    // const modalContent = document.getElementById('modal-content'); // Not directly used in this script
    const modalCloseButton = document.getElementById('modal-close-button');
    const fadeInElements = document.querySelectorAll('.fade-in-element');
    const scrollBanker = document.getElementById('scroll-banker');
    // const logoLink = document.getElementById('logo-link'); // Not directly used in this script

    // --- State ---
    let currentStaticSectionId = 'home'; // Track the currently visible *primary* static section ID
    let isConsentChecked = false; // Track if consent has been handled this session

    // --- Helper Functions ---

    /**
     * Smoothly scrolls to a target element or vertical position, accounting for the sticky header.
     * @param {string|number} target - The selector of the target element (e.g., '#about-us') or a Y-coordinate.
     */
    const smoothScrollTo = (target) => {
        let targetPosition = 0;
        const headerHeight = document.querySelector('header')?.offsetHeight || 70; // Use cached or default height

        if (typeof target === 'string' && target.startsWith('#')) {
            const element = document.querySelector(target);
            if (element) {
                // Calculate position relative to viewport, add scrollY, then adjust for header
                targetPosition = window.scrollY + element.getBoundingClientRect().top - headerHeight - (SCROLL_OFFSET_FOR_NAV - headerHeight); // Apply configured offset
            } else {
                console.warn(`Smooth scroll target not found: ${target}`);
                return; // Exit if target element doesn't exist
            }
        } else if (typeof target === 'number') {
            targetPosition = target;
        } else {
             console.warn(`Invalid smooth scroll target: ${target}`);
             return;
        }

        window.scrollTo({
            top: Math.max(0, targetPosition), // Ensure not scrolling to negative position
            behavior: 'smooth'
        });
    };

     /**
      * Sets up IntersectionObserver to add 'is-visible' class to elements when they enter the viewport.
      * @param {NodeListOf<Element>} elements - The elements to observe.
      */
     const observeFadeInElements = (elements) => {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1 // Trigger when 10% visible
        };

        const intersectionCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); // Stop observing once visible
                }
            });
        };

        const fadeInObserver = new IntersectionObserver(intersectionCallback, observerOptions);

        elements.forEach(el => {
            // Only observe if not already visible
            if (!el.classList.contains('is-visible')) {
                 fadeInObserver.observe(el);
            }
            // Ensure elements already marked 'is-visible' (e.g., by server or previous interaction) have styles applied
            else if (el.classList.contains('is-visible')) {
                 el.style.opacity = '1';
                 el.style.transform = 'translateY(0)';
            }
        });
    };


    /**
     * Shows the relevant static section(s) and hides others.
     * Manages visibility for the main "homepage" view vs. specific sub-sections.
     * Does NOT interact with React visibility directly.
     * @param {string} sectionIdToShow - The ID of the target section (e.g., 'home', 'about-us', 'investing').
     * Use 'home' or one of DEFAULT_HOMEPAGE_SECTIONS for the main view.
     */
    const showStaticSection = (sectionIdToShow) => {
        // Determine if the target is part of the main homepage display
        const isHomepageTarget = DEFAULT_HOMEPAGE_SECTIONS.includes(sectionIdToShow) || sectionIdToShow === '';
        const targetId = isHomepageTarget ? 'home' : sectionIdToShow; // Use 'home' as the primary ID for homepage view

        console.log(`showStaticSection called with: ${sectionIdToShow}. Is homepage target: ${isHomepageTarget}. Effective target ID: ${targetId}`);

        let sectionFound = false;
        mainSections.forEach(section => {
            if (!section.id) return; // Skip sections without ID

            let shouldShow = false;
            if (isHomepageTarget) {
                // If it's a homepage view, show sections listed in DEFAULT_HOMEPAGE_SECTIONS
                shouldShow = DEFAULT_HOMEPAGE_SECTIONS.includes(section.id);
            } else {
                // If it's a specific sub-section view, show only that section
                shouldShow = (section.id === targetId);
            }

            if (shouldShow) {
                section.classList.remove('hidden');
                // Trigger fade-in for elements within the newly shown section(s)
                observeFadeInElements(section.querySelectorAll('.fade-in-element'));
                if (section.id === targetId) {
                    sectionFound = true; // Mark if the primary target was found
                }
            } else {
                section.classList.add('hidden');
            }
        });

        // If the specifically targeted sub-section wasn't found, log warning and default to home
        if (!isHomepageTarget && !sectionFound) {
            console.warn(`Static section with ID "${targetId}" not found. Defaulting to homepage view.`);
            showStaticSection('home'); // Recursive call to show homepage sections
            currentStaticSectionId = 'home';
        } else {
             currentStaticSectionId = targetId; // Update tracked section ID
        }
        // Track section view with Data Layer if available
        if (typeof window.bwamDataLayer?.trackSectionView === 'function') {
            window.bwamDataLayer.trackSectionView(currentStaticSectionId);
        }
    };

    /**
     * Updates the text content and specific attributes of static HTML elements based on the current language.
     * Relies on `data-lang-key` attributes and the global `window.bwamTranslations`.
     * @param {string} lang - The language code ('en', 'de', etc.).
     */
    const updateStaticContentLanguage = (lang) => {
        // Ensure translations are loaded (React might populate this)
        if (!window.bwamTranslations || !window.bwamTranslations[lang]) {
            console.warn(`Translations for language "${lang}" not found.`);
            // Optionally fetch translations here if they aren't embedded
            return;
        }
        const translations = window.bwamTranslations[lang];

        // Helper to safely get nested translation value
        const getTranslation = (key) => {
            try {
                return key.split('.').reduce((obj, k) => obj && obj[k], translations);
            } catch (e) {
                console.warn(`Error accessing translation key: ${key} for language ${lang}`);
                return null;
            }
        };

        // --- Update Text Content ---
        document.querySelectorAll('[data-lang-key]').forEach(element => {
            const key = element.dataset.langKey;
            const translation = getTranslation(key);

            if (translation && typeof translation === 'string') {
                // Update text content more safely:
                // Prioritize updating only the first text node to avoid clobbering icons/children
                let updated = false;
                for (let node of element.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                        node.textContent = translation;
                        updated = true;
                        break;
                    }
                }
                // Fallback for simple elements or if no suitable text node found
                if (!updated && element.children.length === 0) {
                    element.textContent = translation;
                } else if (!updated) {
                     // Maybe it's a button or link where replacing the whole text is fine
                     // Check common tag names - adjust as needed
                     if (['BUTTON', 'A', 'SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'LI'].includes(element.tagName) && !element.querySelector('i[data-lucide]')) {
                          element.textContent = translation;
                     } else {
                        // console.warn(`Could not reliably update text for key "${key}". Element has children.`, element);
                     }
                }

            } else if (key) {
                // console.warn(`Translation not found or not a string for key: ${key} [${lang}]`);
            }
        });

        // --- Update Attributes (aria-label, title, placeholder, etc.) ---
        const attributeMappings = {
            'data-lang-key-aria': 'aria-label',
            'data-lang-key-title': 'title',
            'data-lang-key-placeholder': 'placeholder',
            // Add more attribute mappings here if needed
        };

        for (const dataAttr in attributeMappings) {
            document.querySelectorAll(`[${dataAttr}]`).forEach(element => {
                const key = element.getAttribute(dataAttr);
                const translation = getTranslation(key);
                const targetAttr = attributeMappings[dataAttr];
                if (translation && typeof translation === 'string') {
                    element.setAttribute(targetAttr, translation);
                } else if (key) {
                     // console.warn(`Attr translation not found/string for key: ${key} [${lang}] for attribute ${targetAttr}`);
                     element.removeAttribute(targetAttr); // Optional: remove attribute if translation missing
                }
            });
        }


        // Re-initialize Lucide icons after text changes, as icons might be inside updated elements
        if (typeof lucide !== 'undefined') {
            try {
                lucide.createIcons();
            } catch (error) {
                console.error("Error re-initializing Lucide icons:", error);
            }
        }
    };

    // Expose the language update function globally for React to call
    // Ensure bwamScripts object exists
    window.bwamScripts = window.bwamScripts || {};
    window.bwamScripts.updateStaticContentLanguage = updateStaticContentLanguage;


    // --- Navigation Handling ---

    /**
     * Handles SPA navigation based on URL hash, coordinating between static sections and React view.
     * @param {string} hash - The URL hash (e.g., '#home', '#profile', '#investing').
     */
    const handleNavigation = (hash) => {
        const sectionId = hash ? hash.substring(1) : 'home'; // Default to 'home' if no hash
        const isProfileTarget = (sectionId === 'profile');

        // Attempt to get React's view change function (robust check)
        const changeReactView = window.AppContext?.changeView; // React should expose this via context provider
        const currentReactView = window.AppContext?.view;

        console.log(`handleNavigation: Hash="${hash}", SectionID="${sectionId}", ProfileTarget=${isProfileTarget}, ReactViewAvailable=${!!changeReactView}`);

        if (isProfileTarget) {
            // Target is #profile - Let React handle it
            if (typeof changeReactView === 'function') {
                changeReactView('profile'); // React component will check login status etc.
            } else {
                console.warn("React AppContext.changeView function not found. Cannot switch to profile view reliably.");
                // Fallback (less ideal): Manually hide static content? Only if sure user is logged in.
                // staticContentWrapper?.classList.add('hidden-by-react');
                // reactProfileSection?.classList.add('visible');
                // window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            // Target is a static section (or empty hash -> home)
            const targetStaticSectionId = sectionId || 'home'; // Ensure we have a valid ID

            // Check if React profile is currently visible
            if (currentReactView === 'profile' && typeof changeReactView === 'function') {
                 // If React view is active, tell it to switch back to 'main'
                 changeReactView('main');
                 // Use setTimeout to allow React to re-render and hide its section *before* we show static content
                 setTimeout(() => {
                     console.log(`Switching from React Profile to Static Section: ${targetStaticSectionId}`);
                     showStaticSection(targetStaticSectionId);
                     smoothScrollTo(`#${targetStaticSectionId}`); // Scroll after section is shown
                 }, 50); // Adjust delay if needed based on React component complexity
            } else {
                 // React profile is not visible (or unavailable), just show the static section directly
                 console.log(`Showing Static Section: ${targetStaticSectionId}`);
                 staticContentWrapper?.classList.remove('hidden-by-react'); // Ensure static wrapper is visible
                 reactProfileSection?.classList.remove('visible'); // Ensure profile section is hidden
                 showStaticSection(targetStaticSectionId);
                 smoothScrollTo(`#${targetStaticSectionId}`);
            }
            // Ensure URL reflects the correct static section (especially for empty hash case)
            if (window.location.hash !== `#${currentStaticSectionId}`) {
                 history.replaceState({ section: currentStaticSectionId }, '', `#${currentStaticSectionId}`);
            }
        }

        // Close mobile menu if open after any navigation
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
            mobileMenuButton?.setAttribute('aria-expanded', 'false');
        }
    };


    // --- Event Listeners ---

    // Handle clicks on navigation links (.nav-section-link)
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            const linkText = link.textContent?.trim() || 'N/A';
            const linkLocation = link.closest('header') ? 'header' : link.closest('footer') ? 'footer' : 'body';


            if (href && href.startsWith('#')) {
                e.preventDefault(); // Prevent default jump

                // Track Navigation Click with Data Layer
                 if (typeof window.bwamDataLayer?.trackNavigationClick === 'function') {
                    window.bwamDataLayer.trackNavigationClick({
                        link_url: href,
                        link_text: linkText,
                        link_location: linkLocation
                    });
                 }

                // Only push history state if the hash is actually changing
                if (href !== window.location.hash) {
                    history.pushState({ section: href.substring(1) }, '', href); // Push new state
                    handleNavigation(href); // Handle showing the section/view
                } else {
                    // If clicking the link for the section already displayed, just scroll smoothly
                    smoothScrollTo(href);
                }

            } else {
                 // Track external/non-hash link clicks if needed
                 if (typeof window.bwamDataLayer?.trackNavigationClick === 'function') {
                    window.bwamDataLayer.trackNavigationClick({
                        link_url: href || 'N/A',
                        link_text: linkText,
                        link_location: linkLocation
                    });
                 }
            }
        });
    });

    // Handle browser back/forward buttons (popstate)
    window.addEventListener('popstate', (event) => {
        console.log("Popstate event triggered. New hash:", window.location.hash);
        handleNavigation(window.location.hash || '#home'); // Handle empty hash as home
    });

    // Mobile Menu Toggle
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            const isExpanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';
            mobileMenu.classList.toggle('hidden');
            mobileMenuButton.setAttribute('aria-expanded', String(!isExpanded));
             // Track mobile menu interaction
             if (typeof window.bwamDataLayer?.trackInteraction === 'function') {
                 window.bwamDataLayer.trackInteraction({
                     element_text: !isExpanded ? 'Open Menu' : 'Close Menu',
                     element_location: 'header',
                     element_id: 'mobile-menu-button'
                 });
             }
        });
    }

    // Consent Banner Logic
    const handleConsent = (status) => {
        localStorage.setItem(CONSENT_STORAGE_KEY, status); // 'accepted' or 'rejected'
        if (consentBanner) {
            consentBanner.classList.remove('show');
            // Use transitionend event for more reliable hiding after animation
            consentBanner.addEventListener('transitionend', () => {
                 consentBanner.classList.add('hidden');
            }, { once: true }); // Remove listener after first event
        }
        console.log(`Consent status set to: ${status}`);
        // Track Consent Update
         if (typeof window.bwamDataLayer?.trackConsentUpdate === 'function') {
            window.bwamDataLayer.trackConsentUpdate(status);
         }

        // Potentially trigger analytics initialization if accepted
        if (status === 'accepted' && typeof window.enableAnalytics === 'function') { // Check for a specific function you define
             window.enableAnalytics();
        }
        isConsentChecked = true;
    };

    if (consentAcceptButton) {
        consentAcceptButton.addEventListener('click', () => handleConsent('accepted'));
    }
    if (consentRejectButton) {
        consentRejectButton.addEventListener('click', () => handleConsent('rejected'));
    }

    // Check consent status on load
    const initialConsentStatus = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!initialConsentStatus && consentBanner) { // Only show if status is not set
        setTimeout(() => {
            consentBanner.classList.remove('hidden');
            // Force reflow before adding class to ensure transition runs
            void consentBanner.offsetWidth;
            consentBanner.classList.add('show');
        }, 500); // Delay showing the banner slightly
    } else if (initialConsentStatus) {
        isConsentChecked = true; // Already decided
        if (initialConsentStatus === 'accepted' && typeof window.enableAnalytics === 'function') {
            window.enableAnalytics(); // Initialize analytics if consent was previously given
        }
    }


    // Advisor Modal Logic
    const openModal = () => {
        if (!advisorModal) return;
        advisorModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        // Force reflow
        void advisorModal.offsetWidth;
        advisorModal.classList.add('show'); // Add class to trigger transition
        // Track Modal View
         if (typeof window.bwamDataLayer?.trackModalView === 'function') {
            window.bwamDataLayer.trackModalView('advisor-modal');
         }
    };

    const closeModal = () => {
        if (!advisorModal) return;
        advisorModal.classList.remove('show');
        document.body.style.overflow = ''; // Restore background scrolling
         // Hide after transition finishes
         advisorModal.addEventListener('transitionend', () => {
             advisorModal.classList.add('hidden');
         }, { once: true });
    };

    if (contactCtaButton) {
        contactCtaButton.addEventListener('click', openModal);
    }
    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', closeModal);
    }
    if (modalOverlay) {
        // Use mousedown + mouseup on overlay to prevent closing if user drags cursor out
        let mouseDownTarget = null;
         modalOverlay.addEventListener('mousedown', (e) => { mouseDownTarget = e.target; });
         modalOverlay.addEventListener('mouseup', (e) => {
             if (e.target === mouseDownTarget && e.target === modalOverlay) {
                 closeModal();
             }
             mouseDownTarget = null;
         });
    }
    // Close modal on Escape key press
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && advisorModal && !advisorModal.classList.contains('hidden') && advisorModal.classList.contains('show')) {
            closeModal();
        }
    });

    // Scrolling Banker Icon Logic
    const scrollThreshold = 300; // Pixels from top to show the icon
    let lastScrollTop = 0;

    const handleScrollBanker = () => {
        if (!scrollBanker) return;
        // Use pageYOffset for broader compatibility, fallback to documentElement.scrollTop
        let st = window.pageYOffset || document.documentElement.scrollTop;

        if (st > scrollThreshold) {
            scrollBanker.classList.add('visible');
        } else {
            scrollBanker.classList.remove('visible');
        }
        lastScrollTop = st <= 0 ? 0 : st; // For Mobile or negative scrolling
    };

    // Use passive listener and throttle/debounce if performance issues arise
    window.addEventListener('scroll', handleScrollBanker, { passive: true });


    // --- Initialization ---

    // Initial setup for fade-in elements
    observeFadeInElements(fadeInElements);

    // Initial check for scroll banker visibility
    handleScrollBanker();

    // Initial language update based on HTML lang attribute
    // Ensure this runs after potential translation object population by React
    // (This placement inside DOMContentLoaded should be fine if React renders quickly)
    const initialLang = document.documentElement.lang || 'en'; // Default to 'en' if not set
    console.log(`Initial language detected: ${initialLang}. Updating static content.`);
    updateStaticContentLanguage(initialLang);

    // Set footer year dynamically
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Initial page load: Handle navigation based on the initial hash
    // Defer slightly to ensure React context might be available
    setTimeout(() => {
        console.log("Initial page navigation check. Hash:", window.location.hash);
        handleNavigation(window.location.hash); // Handle initial hash after setup
         // Track initial page view
         if (typeof window.bwamDataLayer?.trackPageView === 'function') {
            window.bwamDataLayer.trackPageView({
                 pagePath: window.location.pathname + window.location.hash,
                 pageTitle: document.title,
                 language: initialLang
            });
         }
    }, 0);


}); // End DOMContentLoaded
