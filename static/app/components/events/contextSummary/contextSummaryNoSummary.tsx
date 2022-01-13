import Item from './item';

interface Props {
  title: string;
}

const ContextSummaryNoSummary = ({title}: Props) => (
  <Item icon={<span className="context-item-icon" />}>
    <h3 data-test-id="no-summary-title">{title}</h3>
  </Item>
);

export default ContextSummaryNoSummary;
