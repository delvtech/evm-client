import { CoreVoting } from "integration-tests/artifacts/CoreVoting";
import { createCachedReadContract } from "src/contract/createCachedReadContract";
import { createPublicClient, http } from "viem";
import { describe, it } from "vitest";

describe.todo("integration", () => {
  it("It fetches events", async () => {
    const client = createPublicClient({
      transport: http("http://localhost:8545"),
    });

    const coreVotingContract = createCachedReadContract({
      abi: CoreVoting.abi,
      address: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
      publicClient: client,
    });

    const result = await coreVotingContract.getEvents("ProposalCreated");
    console.log("result:", result);
  });
});
