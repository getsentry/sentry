import "./Row.scss";

const Row = ({ category, value }) =>
  category && (value || value === 0) ? (
    <div className="row">
      <div className="category-cell">{category}</div>
      <div className="value-cell">{value}</div>
    </div>
  ) : null;

export default Row;
