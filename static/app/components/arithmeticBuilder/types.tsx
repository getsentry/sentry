import type {ReactNode} from 'react';

import type {FieldKind} from 'sentry/utils/fields';

export interface FunctionArgument {
  kind: FieldKind;
  name: string;
  label?: ReactNode;
}
