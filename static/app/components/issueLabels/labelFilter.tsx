import {useEffect, useMemo, useState} from 'react';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {useIssueLabels} from 'sentry/hooks/useIssueLabels';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';

interface LabelFilterProps {
  onLabelChange: (labels: string[]) => void;
  selectedLabels: string[];
  size?: 'xs' | 'sm' | 'md';
}

export function LabelFilter({
  selectedLabels,
  onLabelChange,
  size = 'sm',
}: LabelFilterProps) {
  const {getAllLabelNames} = useIssueLabels();

  // Local state to manage the selection - should be string array like the reference
  const [localSelectedLabels, setLocalSelectedLabels] =
    useState<string[]>(selectedLabels);

  // Sync local state with parent prop
  useEffect(() => {
    setLocalSelectedLabels(selectedLabels);
  }, [selectedLabels]);

  const labelOptions = useMemo(() => {
    const allLabels = getAllLabelNames();

    // Use the exact same pattern as the working reference - sections with nested options
    const options = [
      {
        key: 'labels',
        label: t('Labels'),
        options: allLabels.map(label => {
          const cleanLabel = label.trim();
          return {
            value: cleanLabel,
            label: cleanLabel,
          };
        }),
      },
    ];

    return options;
  }, [getAllLabelNames]);

  const handleChange = (selected: Array<SelectOption<string>>) => {
    console.log('selected:', selected);
    // Extract string values from the option objects, just like the reference
    const values = selected.map(opt => opt.value);

    // Update local state first
    setLocalSelectedLabels(values);

    // Then notify parent
    onLabelChange(values);
  };

  const triggerLabel = useMemo(() => {
    if (!localSelectedLabels.length) return t('Labels');
    if (localSelectedLabels.length === 1) return localSelectedLabels[0];
    if (localSelectedLabels.length === 2)
      return `${localSelectedLabels[0]}, ${localSelectedLabels[1]}`;
    return `${localSelectedLabels[0]}, ${localSelectedLabels[1]} +${localSelectedLabels.length - 2}`;
  }, [localSelectedLabels]);

  return (
    <CompactSelect
      multiple
      value={localSelectedLabels}
      onChange={handleChange}
      options={labelOptions}
      triggerLabel={triggerLabel}
      triggerProps={{
        icon: <IconFilter size="xs" />,
        size,
      }}
      size={size}
      menuTitle={t('Select labels to filter by')}
      clearable
      closeOnSelect={false}
    />
  );
}

// No extra styles needed; rely on CompactSelect defaults
