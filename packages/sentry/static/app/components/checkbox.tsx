const Checkbox = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input type="checkbox" {...props} />
);

Checkbox.defaultProps = {
  checked: false,
};

export default Checkbox;
