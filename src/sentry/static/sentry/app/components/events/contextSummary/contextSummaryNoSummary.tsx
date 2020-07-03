import React from 'react';

type Props = {
  title: string;
};

const ContextSummaryNoSummary = ({title}: Props) => (
  <div className="context-item">
    <span className="context-item-icon" />
    <h3 data-test-id="no-summary-title">{title}</h3>
  </div>
);

export default ContextSummaryNoSummary;
