import {Button} from '@sentry/scraps/button';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons/iconEllipsis';
import {t} from 'sentry/locale';
import {
  useDeleteQueryAtIndex,
  useDuplicateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  Section,
  SectionHeader,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

type Props = {
  index: number;
  totalQueryRows: number;
};

export function MenuSection({index, totalQueryRows}: Props) {
  const deleteQuery = useDeleteQueryAtIndex();
  const duplicateQuery = useDuplicateQueryAtIndex();

  return (
    <Section>
      {/* Match SectionHeader height so the menu aligns with sibling selects. */}
      <SectionHeader aria-hidden="true">&nbsp;</SectionHeader>
      <DropdownMenu
        items={[
          {
            key: 'delete-query',
            label: t('Delete Query'),
            onAction: () => deleteQuery(index),
            disabled: totalQueryRows === 1,
          },
          {
            key: 'duplicate-query',
            label: t('Duplicate Query'),
            onAction: () => duplicateQuery(index),
          },
        ]}
        trigger={triggerProps => (
          <Button
            {...triggerProps}
            aria-label={t('More options')}
            icon={<IconEllipsis size="xs" />}
          />
        )}
      />
    </Section>
  );
}
