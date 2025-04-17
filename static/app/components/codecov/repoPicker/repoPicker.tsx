import {updateRepository} from 'sentry/actionCreators/pageFilters';
import type {RepoSelectorProps} from 'sentry/components/codecov/repoPicker/repoSelector';
import {RepoSelector} from 'sentry/components/codecov/repoPicker/repoSelector';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

export interface RepoPickerProps
  extends Partial<
    Partial<Omit<RepoSelectorProps, 'relative' | 'menuBody' | 'repository'>>
  > {}

export function RepoPicker({
  menuWidth,
  triggerProps = {},
  ...selectProps
}: RepoPickerProps) {
  const router = useRouter();
  const {selection} = usePageFilters();
  const repository = selection?.repository ?? null;

  return (
    <RepoSelector
      {...selectProps}
      repository={repository}
      onChange={newRepository => {
        updateRepository(newRepository, router, {
          save: true,
        });
      }}
      menuWidth={menuWidth ? '22em' : undefined}
      triggerProps={triggerProps}
    />
  );
}
