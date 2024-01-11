import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

interface Props {
  tags: Record<string, string>;
  collapsed?: boolean;
}

export default function TagsSection({tags, collapsed}: Props) {
  const entries = Object.entries(tags);

  return (
    <KeyValueTable
      noMargin
      style={
        collapsed
          ? {maxHeight: '90px', overflow: 'hidden', marginBottom: `${space(1)}`}
          : undefined
      }
    >
      {entries.map(([key, value]) => (
        <KeyValueTableRow
          key={key}
          keyName={key}
          value={
            <Tooltip showOnlyOnOverflow title={value}>
              <TextOverflow>{value}</TextOverflow>
            </Tooltip>
          }
        />
      ))}
    </KeyValueTable>
  );
}
