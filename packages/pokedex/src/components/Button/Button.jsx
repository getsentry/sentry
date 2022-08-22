import "./Button.scss";

const Button = ({ children, ...rest }) => (
  <button className="button" type="button" {...rest}>
    {children}
  </button>
);

export default Button;
