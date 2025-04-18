import moment from 'moment-timezone';

import {ActionType} from 'sentry/types/workflowEngine/actions';
import {DataConditionGroupLogicType} from 'sentry/types/workflowEngine/dataConditions';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {
  useApiQueries,
  useApiQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

const mockDetectors: Detector[] = [
  {
    createdBy: '3363271',
    dateCreated: moment().subtract(7, 'days').toDate(),
    dateUpdated: moment().subtract(31, 'minutes').toDate(),
    id: 'def123',
    lastTriggered: moment().subtract(8, 'days').toDate(),
    workflowIds: ['123456789'],
    config: {},
    dataCondition: {
      conditions: [],
      id: 'def456',
      logicType: DataConditionGroupLogicType.ALL,
      actions: [{data: {}, id: '1', type: ActionType.EMAIL}],
    },
    dataSource: {
      id: '',
      snubaQuery: {
        aggregate: '',
        dataset: '',
        id: '',
        query: '',
        timeWindow: 60,
        environment: '',
      },
      status: 1,
      subscription: '',
    },
    disabled: false,
    name: 'CLS Anomaly',
    projectId: '11276',
    type: 'metric',
  },
  {
    createdBy: 'sentry',
    dateCreated: moment().subtract(7, 'days').toDate(),
    dateUpdated: moment().subtract(31, 'minutes').toDate(),
    id: 'def123',
    lastTriggered: moment().subtract(1, 'days').toDate(),

    workflowIds: ['123456789'],
    config: {},
    dataCondition: {
      conditions: [],
      id: 'def456',
      logicType: DataConditionGroupLogicType.ALL,
      actions: [{data: {}, id: '1', type: ActionType.EMAIL}],
    },
    dataSource: {
      id: '',
      snubaQuery: {
        aggregate: '',
        dataset: '',
        id: '',
        query: '',
        timeWindow: 60,
        environment: '',
      },
      status: 1,
      subscription: '',
    },
    disabled: false,
    name: 'Error Grouping',
    projectId: '1',
    type: 'errors',
  },
  {
    createdBy: 'sentry',
    dateCreated: moment().subtract(7, 'days').toDate(),
    dateUpdated: moment().subtract(31, 'minutes').toDate(),
    id: 'abc123',
    lastTriggered: moment().subtract(1, 'days').toDate(),

    workflowIds: ['123456789', '987654321'],
    config: {},
    dataCondition: {
      conditions: [],
      id: 'def456',
      logicType: DataConditionGroupLogicType.ALL,
      actions: [{data: {}, id: '1', type: ActionType.EMAIL}],
    },
    dataSource: {
      id: '',
      snubaQuery: {
        aggregate: '',
        dataset: '',
        id: '',
        query: '',
        timeWindow: 60,
        environment: '',
      },
      status: 1,
      subscription: '',
    },
    disabled: false,
    name: 'Rage Click',
    projectId: '11276',
    type: 'replay',
  },
];

export interface UseDetectorsQueryOptions {
  query?: string;
  sort?: string;
}
export function useDetectorsQuery(
  projectId: string,
  _options: UseDetectorsQueryOptions = {}
) {
  // const org = useOrganization();
  // return useApiQuery<Detector[]>([`/projects/${org.slug}/${projectId}/detectors/`], {
  //   staleTime: 0,
  //   retry: false
  // })
  return useQuery<Detector[]>({
    queryKey: [`/projects/${projectId}/detectors/`],
    queryFn: () => mockDetectors,
    staleTime: 0,
    retry: false,
  });
}

export const makeDetectorQueryKey = (orgSlug: string, detectorId = ''): [url: string] => [
  `/organizations/${orgSlug}/detectors/${detectorId}`,
];

export function useCreateDetector(detector: Detector) {
  const org = useOrganization();
  return useQuery<Detector>({
    queryKey: [...makeDetectorQueryKey(org.slug), detector],
    queryFn: () => {
      mockDetectors.push(detector);
      return detector;
    },
    staleTime: 0,
    retry: false,
  });
  return useApiQuery<Detector>(
    [...makeDetectorQueryKey(org.slug), {method: 'POST', data: detector}],
    {
      staleTime: 0,
      retry: false,
    }
  );
}

export function useDetectorQuery(detectorId: string) {
  const org = useOrganization();

  return useQuery<Detector>({
    queryKey: makeDetectorQueryKey(org.slug, detectorId),
    queryFn: () => {
      return mockDetectors.find(d => d.id === detectorId)!;
    },
    staleTime: 0,
    retry: false,
  });

  return useApiQuery<Detector>(makeDetectorQueryKey(org.slug, detectorId), {
    staleTime: 0,
    retry: false,
  });
}

export function useDetectorQueriesByIds(detectorId: string[]) {
  const org = useOrganization();

  return useApiQueries<Detector[]>(
    detectorId.map(id => makeDetectorQueryKey(org.slug, id)),
    {
      staleTime: 0,
      retry: false,
    }
  );
}

export function useDetectorMutation(detector: Partial<Detector> & {id: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const org = useOrganization();
  const queryKey = makeDetectorQueryKey(org.slug, detector.id);
  return useMutation<Detector>({
    mutationFn: data =>
      api.requestPromise(queryKey[0], {
        method: 'PUT',
        data,
      }),
    onSuccess: _ => {
      queryClient.invalidateQueries({queryKey});
      // setApiQueryData<Project>(
      //   queryClient,
      //   makeDetailedProjectQueryKey({
      //     orgSlug: organization.slug,
      //     projectSlug: project.slug,
      //   }),
      //   existingData => (updatedProject ? updatedProject : existingData)
      // );
      // return onSuccess?.(updatedProject);

      // eslint-disable-next-line no-console
      console.log('updated detector');
    },
    onError: error => {
      // eslint-disable-next-line no-console
      console.error('error updating detector', error);
    },
  });
}
