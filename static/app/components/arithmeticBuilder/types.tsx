import type {ReactNode} from 'react';

// eslint-disable-next-line @sentry/scraps/restrict-types-file -- type-only import from a runtime module; extracting a type leaf would cascade to its many importers
import type {FieldKind} from 'sentry/utils/fields';

export interface FunctionArgument {
  kind: FieldKind;
  name: string;
  label?: ReactNode;
}
