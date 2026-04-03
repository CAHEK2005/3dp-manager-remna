import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from '../settings/entities/setting.entity';
import { RemnavaveModule } from '../remnawave/remnawave.module';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';
import { ScriptsModule } from '../scripts/scripts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Setting]),
    RemnavaveModule,
    ScriptsModule,
  ],
  controllers: [NodesController],
  providers: [NodesService],
  exports: [NodesService],
})
export class NodesModule {}
