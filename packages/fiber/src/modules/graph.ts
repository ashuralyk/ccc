import { FiberClient } from "../client.js";
import { ChannelInfo, Pubkey } from "../types.js";

export class GraphModule {
  constructor(private client: FiberClient) {}

  /**
   * 获取节点列表
   */
  async graphNodes(): Promise<Pubkey[]> {
    return this.client.call("graph_nodes", []);
  }

  /**
   * 获取通道列表
   */
  async graphChannels(): Promise<ChannelInfo[]> {
    return this.client.call("graph_channels", []);
  }
} 