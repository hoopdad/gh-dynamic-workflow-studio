import { defineWorkflow, joinSession } from "@github/copilot-sdk/extension";
import { deliveryWorkflow } from "./workflow.mjs";

await joinSession({ workflows: [defineWorkflow(deliveryWorkflow)] });
