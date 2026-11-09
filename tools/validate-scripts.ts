import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { SceneDefinition, ScriptChoice, ScriptNode } from '../src/engine/types';

const SCRIPTS_DIR = path.resolve('src/scripts');
const PUBLIC_DIR = path.resolve('public');

const yamlFiles = fs.readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith('.yaml'));
const allScenes = new Map<string, SceneDefinition>();

for (const file of yamlFiles) {
  const raw = fs.readFileSync(path.join(SCRIPTS_DIR, file), 'utf-8');
  const parsed = YAML.parse(raw) as SceneDefinition[];
  for (const scene of parsed) {
    if (allScenes.has(scene.scene)) {
      throw new Error(`Duplicate scene ID: ${scene.scene}`);
    }
    allScenes.set(scene.scene, scene);
  }
}

const referencedTargets: { from: string; to: string }[] = [];
const endingsFound = new Set<string>();

function inspectNodes(sceneId: string, nodes: ScriptNode[]): void {
  for (const node of nodes) {
    if ('goto' in node) {
      referencedTargets.push({ from: sceneId, to: node.goto });
    }
    if ('bg' in node) {
      checkAsset(sceneId, node.bg);
    }
    if ('cg' in node && node.cg) {
      checkAsset(sceneId, node.cg);
    }
    if ('chapterCard' in node) {
      checkAsset(sceneId, node.chapterCard.image);
    }
    if ('if' in node) {
      inspectNodes(sceneId, node.then);
      if (node.else) inspectNodes(sceneId, node.else);
    }
    if ('choice' in node) {
      const choiceObj: ScriptChoice = Array.isArray(node.choice)
        ? { options: node.choice }
        : node.choice;
      for (const opt of choiceObj.options) {
        if (opt.goto) referencedTargets.push({ from: sceneId, to: opt.goto });
        if (opt.lines) inspectNodes(sceneId, opt.lines);
      }
    }
    if ('hotspotScene' in node) {
      if (node.hotspotScene.continueGoto) {
        referencedTargets.push({ from: sceneId, to: node.hotspotScene.continueGoto });
      }
      for (const hs of node.hotspotScene.hotspots) {
        inspectNodes(sceneId, hs.lines);
      }
    }
    if ('ending' in node) {
      endingsFound.add(node.ending.id);
    }
  }
}

function checkAsset(sceneId: string, relUrl: string): void {
  const clean = relUrl.replace(/^\.\//, '');
  const full = path.join(PUBLIC_DIR, clean);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing asset in scene "${sceneId}": ${relUrl}`);
  }
}

for (const [sceneId, scene] of allScenes.entries()) {
  if (scene.bg) checkAsset(sceneId, scene.bg);
  inspectNodes(sceneId, scene.lines);
}

for (const ref of referencedTargets) {
  if (!allScenes.has(ref.to)) {
    throw new Error(`Broken goto in scene "${ref.from}" -> "${ref.to}"`);
  }
}

console.log(
  `[validate-scripts] OK — ${allScenes.size} scenes verified, ${referencedTargets.length} goto links valid, ${endingsFound.size} ending marker(s) reachable.`
);
