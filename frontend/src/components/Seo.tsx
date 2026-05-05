import { useEffect } from 'react';

type SeoProps = {
  title: string;
  description?: string;
  canonicalUrl?: string | null;
  noindex?: boolean;
  nofollow?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string | null;
  ogType?: 'website' | 'article' | 'profile' | 'product' | 'video.other';
  siteName?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>> | null;
};

const DEFAULT_SITE_NAME = 'PollMaster';

const resolveBaseUrl = () => {
  const envBaseUrl =
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_SITE_URL ||
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_APP_BASE_URL;

  if (envBaseUrl && envBaseUrl.trim()) {
    return envBaseUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return 'http://localhost:5173';
};

const normalizeUrl = (url: string) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = resolveBaseUrl();
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const upsertMeta = (selector: string, attrs: Record<string, string>) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attrs).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });

  return element;
};

const upsertLink = (selector: string, attrs: Record<string, string>) => {
  let element = document.head.querySelector<HTMLLinkElement>(selector);

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attrs).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });

  return element;
};

export default function Seo({
  title,
  description,
  canonicalUrl,
  noindex = false,
  nofollow = false,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
  siteName = DEFAULT_SITE_NAME,
  jsonLd = null,
}: SeoProps) {
  useEffect(() => {
    const previousTitle = document.title;

    const resolvedTitle = title?.trim()
      ? `${title.trim()} | ${siteName}`
      : siteName;

    document.title = resolvedTitle;

    const robotsContent = [
      noindex ? 'noindex' : 'index',
      nofollow ? 'nofollow' : 'follow',
    ].join(',');

    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: description?.trim() || `${siteName} — платформа для голосований и опросов.`,
    });

    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: robotsContent,
    });

    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: ogTitle?.trim() || resolvedTitle,
    });

    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: ogDescription?.trim() || description?.trim() || `${siteName} — платформа для голосований и опросов.`,
    });

    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: ogType,
    });

    upsertMeta('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: siteName,
    });

    const canonical = canonicalUrl ? normalizeUrl(canonicalUrl) : '';
    const canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (canonical) {
      if (canonicalLink) {
        canonicalLink.setAttribute('href', canonical);
      } else {
        upsertLink('link[rel="canonical"]', {
          rel: 'canonical',
          href: canonical,
        });
      }

      upsertMeta('meta[property="og:url"]', {
        property: 'og:url',
        content: canonical,
      });
    } else if (canonicalLink) {
      canonicalLink.remove();
    }

    if (ogImage) {
      upsertMeta('meta[property="og:image"]', {
        property: 'og:image',
        content: normalizeUrl(ogImage),
      });
    } else {
      const ogImageMeta = document.head.querySelector<HTMLMetaElement>(
        'meta[property="og:image"]',
      );
      if (ogImageMeta) ogImageMeta.remove();
    }

    const existingJsonLd = document.head.querySelector<HTMLScriptElement>('script[data-seo-jsonld="true"]');
    if (existingJsonLd) {
      existingJsonLd.remove();
    }

    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-jsonld', 'true');
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.title = previousTitle;
    };
  }, [
    title,
    description,
    canonicalUrl,
    noindex,
    nofollow,
    ogTitle,
    ogDescription,
    ogImage,
    ogType,
    siteName,
    jsonLd,
  ]);

  return null;
}
