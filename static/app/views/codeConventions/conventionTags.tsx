import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {conventionQueryOptions} from 'sentry/views/codeConventions/utils';

interface Props {
  filename: string;
}

export function ConventionTags({filename}: Props) {
  const {data: convention, isPending} = useQuery(conventionQueryOptions(filename));

  if (isPending) {
    return <Placeholder width="120px" height="20px" />;
  }

  if (!convention?.tags?.length) {
    return null;
  }

  return (
    <Flex gap="xs" wrap="wrap">
      {convention.tags.map(tag => (
        <Tag key={tag} variant="muted">
          {tag}
        </Tag>
      ))}
    </Flex>
  );
}
