import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Select} from 'sentry/components/core/select';
import RuleNode, {ruleNodesMap} from 'sentry/views/automations/components/ruleNode';

interface RuleNodeListProps {
  groupId: string;
  placeholder: string;
}

export default function RuleNodeList({groupId, placeholder}: RuleNodeListProps) {
  const [items, setItems] = useState<string[]>([]);

  const onAddRow = value => {
    setItems(prevItems => [...prevItems, value]);
  };

  const onDeleteRow = index => {
    setItems(prevItems => prevItems.filter((_, idx) => idx !== index));
  };

  const options = Object.entries(ruleNodesMap).map(([value, node]) => ({
    value,
    label: node.label,
  }));

  return (
    <Fragment>
      {items.map((item, idx) => (
        <RuleNode
          type={item}
          key={idx}
          onDelete={() => onDeleteRow(idx)}
          groupId={groupId}
        />
      ))}
      <StyledSelectControl
        options={options}
        onChange={(obj: any) => onAddRow(obj.value)}
        placeholder={placeholder}
        value={null}
      />
    </Fragment>
  );
}

const StyledSelectControl = styled(Select)`
  width: 100%;
`;
