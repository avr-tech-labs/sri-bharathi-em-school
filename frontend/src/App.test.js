import { fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
import App from './App';

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: [] }))
}));

describe('school website home page', () => {
  beforeEach(() => {
    window.localStorage.clear();
    axios.get.mockResolvedValue({ data: [] });
  });

  test('shows useful school and learning information', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /SRI BHARATHI E\.M\. SCHOOL/i })).toBeInTheDocument();
    expect(screen.getByText('A journey from first steps to independent thinking')).toBeInTheDocument();
    expect(screen.getByText('Strong basics, one subject at a time')).toBeInTheDocument();
    expect(screen.getByText('No notices have been published. Please check back for school updates.')).toBeInTheDocument();
  });

  test('opens the admission FAQ answer', () => {
    render(<App />);

    fireEvent.click(screen.getByText('Which classes are offered?'));

    expect(screen.getByText(/The school website lists classes from Nursery, LKG and UKG through 6th Class/i)).toBeInTheDocument();
  });

  test('switches and remembers the selected theme', () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

    expect(container.querySelector('.app-shell')).toHaveClass('theme-dark');
    expect(window.localStorage.getItem('school-system-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });
});
