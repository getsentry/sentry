type Props = {
  size: string;
  onSizeChange: (size: string) => void;
};

const SizeSelector = ({size, onSizeChange}: Props) => {
  const handleChange = e => {
    e.preventDefault();
    onSizeChange(e.target.value);
  };

  return (
    <select value={size} onChange={handleChange}>
      <option value="small">Small</option>
      <option value="medium">Medium</option>
      <option value="large">Large</option>
    </select>
  );
};

export default SizeSelector;
