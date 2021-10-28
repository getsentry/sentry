import {ComponentProps} from 'react';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Tooltip from 'app/components/tooltip';

type DropdownItemProps = Pick<
  ComponentProps<typeof DropdownItem>,
  'disabled' | 'title'
> & {
  label: string;
  tooltip?: string;
};

type Props = {
  label: string;
  options: Record<string, DropdownItemProps>;
  selected: string;
  onSelect: (key: string) => void;
  className?: string;
};

const ReleasesDropdown = ({
  label: prefix,
  options,
  selected,
  onSelect,
  className,
}: Props) => {
  const optionEntries = Object.entries(options);
  const selectedLabel = optionEntries.find(([key, _value]) => key === selected)?.[1];

  return (
    <DropdownControl
      alwaysRenderMenu={false}
      buttonProps={{prefix}}
      label={selectedLabel?.label}
      className={className}
    >
      {optionEntries.map(([key, {label, tooltip, ...props}]) => (
        <Tooltip
          key={key}
          containerDisplayMode="block"
          title={tooltip}
          delay={500}
          disabled={!tooltip}
        >
          <DropdownItem
            onSelect={onSelect}
            eventKey={key}
            isActive={selected === key}
            {...props}
          >
            {label}
          </DropdownItem>
        </Tooltip>
      ))}
    </DropdownControl>
  );
};

export default ReleasesDropdown;
