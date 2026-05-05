import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Seo from '../Seo';


describe('Seo component', () => {
  it('writes title, meta description, robots and canonical', () => {
    render(
      <Seo
        title="Landing"
        description="SEO description"
        canonicalUrl="/"
        noindex={false}
        nofollow={false}
      />,
    );

    expect(document.title).toContain('Landing');
    expect(
      document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
    ).toBe('SEO description');
    expect(
      document.head.querySelector('meta[name="robots"]')?.getAttribute('content'),
    ).toBe('index,follow');
    expect(
      document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toContain('/');
  });

  it('adds json-ld script when provided', () => {
    render(
      <Seo
        title="Page"
        jsonLd={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'PollMaster' }}
      />,
    );

    const script = document.head.querySelector('script[data-seo-jsonld="true"]');
    expect(script).toBeInTheDocument();
    expect(script?.textContent).toContain('PollMaster');
  });
});
