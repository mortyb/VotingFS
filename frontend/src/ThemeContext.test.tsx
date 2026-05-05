import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ThemeProvider, useTheme } from './ThemeContext';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  );
}

describe('ThemeContext', () => {
  it('toggles between light and dark and updates root class', () => {
    localStorage.removeItem('theme');

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
