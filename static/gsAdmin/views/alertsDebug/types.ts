import {z} from 'zod';

export const workflowIdSchema = z.object({
  workflowId: z
    .number({message: 'Workflow ID is required'})
    .int('Workflow ID must be an integer')
    .positive('Workflow ID must be positive')
    .optional()
    .refine(val => val !== undefined, {message: 'Workflow ID is required'}),
});

export const workflowEventDebugForm = z.object({
  workflowId: z.number().int().positive(),
  eventIds: z.array(z.string()),
});

export type WorkflowIdFormData = z.infer<typeof workflowIdSchema>;
export type WorkflowEventDebugFormData = z.infer<typeof workflowEventDebugForm>;
