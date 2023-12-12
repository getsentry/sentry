import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';

interface Props {
  tags: Record<string, string>;
}

export default function TagsSection({tags}: Props) {
  const entries = Object.entries(tags);

  return (
    <KeyValueTable noMargin>
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
