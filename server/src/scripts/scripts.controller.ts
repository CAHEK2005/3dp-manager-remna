import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, HttpException, HttpStatus,
} from '@nestjs/common';
import { ScriptsService } from './scripts.service';

@Controller('scripts')
export class ScriptsController {
  constructor(private scriptsService: ScriptsService) {}

  // ── SSH Nodes ────────────────────────────────────────────────────────────────

  @Get('ssh-nodes')
  getSshNodes() {
    return this.scriptsService.getSshNodes();
  }

  @Post('ssh-nodes')
  async addSshNode(@Body() body: any) {
    try {
      return await this.scriptsService.upsertSshNode(body);
    } catch (e) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Patch('ssh-nodes/:id')
  async updateSshNode(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.scriptsService.upsertSshNode({ ...body, id });
    } catch (e) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('ssh-nodes/:id')
  async deleteSshNode(@Param('id') id: string) {
    try {
      await this.scriptsService.deleteSshNode(id);
      return { success: true };
    } catch (e) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  // ── Scripts ──────────────────────────────────────────────────────────────────

  @Get('scripts')
  getScripts() {
    return this.scriptsService.getScripts();
  }

  @Post('scripts')
  async createScript(@Body() body: any) {
    try {
      return await this.scriptsService.upsertScript(body);
    } catch (e) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Patch('scripts/:id')
  async updateScript(@Param('id') id: string, @Body() body: any) {
    try {
      return await this.scriptsService.upsertScript({ ...body, id });
    } catch (e) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('scripts/:id')
  async deleteScript(@Param('id') id: string) {
    try {
      await this.scriptsService.deleteScript(id);
      return { success: true };
    } catch (e) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  // ── Execute ──────────────────────────────────────────────────────────────────

  @Post('execute')
  async execute(@Body() body: { scriptId: string; nodeIds: string[] }) {
    try {
      return await this.scriptsService.executeScript(body.scriptId, body.nodeIds);
    } catch (e) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('execute/:jobId')
  getExecuteStatus(@Param('jobId') jobId: string) {
    const job = this.scriptsService.getJobStatus(jobId);
    if (!job) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    return job;
  }
}
