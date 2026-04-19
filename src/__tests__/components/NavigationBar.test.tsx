import { render, screen } from "@testing-library/react";
import NavigationBar from "../../components/NavigationBar";

const defaultProps = {
  title: "Test",
  darkMode: false,
  onToggleDark: () => {},
  view: "dashboard" as const,
  onChangeView: () => {},
};

describe("NavigationBar", () => {
  it("renders the title text", () => {
    render(<NavigationBar {...defaultProps} title="Video Dashboard" />);
    expect(screen.getByText("Video Dashboard")).toBeInTheDocument();
  });

  it("has fixed positioning classes", () => {
    const { container } = render(<NavigationBar {...defaultProps} />);
    const nav = container.querySelector("nav");
    expect(nav).toHaveClass("fixed", "top-0", "left-0", "right-0");
  });

  it("has a z-index class for stacking", () => {
    const { container } = render(<NavigationBar {...defaultProps} />);
    const nav = container.querySelector("nav");
    expect(nav).toHaveClass("z-50");
  });

  it("includes dark mode variant classes", () => {
    const { container } = render(<NavigationBar {...defaultProps} />);
    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("dark:bg-gray-900");
  });
});
