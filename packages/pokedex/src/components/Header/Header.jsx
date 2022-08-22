import "./Header.scss";
import { useScrollDirection } from "../../hooks";
import * as SCROLL from "../../constants/scrolldirection";

const Header = ({ children, style, ...rest }) => {
  const scrollDirection = useScrollDirection();
  return (
    <header
      className="header"
      style={{
        ...style,
        transform:
          scrollDirection === SCROLL.DOWN
            ? "translateY(-60px)"
            : "translateY(0)",
      }}
      {...rest}
    >
      {children}
    </header>
  );
};

export default Header;
